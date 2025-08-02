import { v4 as uuidv4 } from "uuid";
import { Event } from "../../../submodules/werift/packages/common/src/event.js";
import type { ConnectionManager } from "./connectionManager.js";
import { DataSubscription } from "./dataSubscription.js";
import type { JsonRpc } from "./imports/json-rpc.js";
import { MediaSubscription } from "./mediaSubscription.js";
import type { MediaStreamTrackLike } from "./type.js";

interface PendingMediaSubscription {
  resolve: (subscription: MediaSubscription) => void;
  reject: (error: Error) => void;
  subscription: MediaSubscription;
}

export interface RemotePublication {
  id: string;
  publisher: string;
  type: "audio" | "video" | "data";
  metadata?: Record<string, any>;
}

export class Subscriber {
  private dataSubscriptions = new Map<string, DataSubscription>();
  private mediaSubscriptions = new Map<string, MediaSubscription>();
  private pendingMediaSubscriptions = new Map<
    string,
    PendingMediaSubscription
  >();
  private remoteDataPublications = new Map<string, RemotePublication>();
  private remoteMediaPublications = new Map<string, RemotePublication>();

  // Events
  readonly onSubscribeOfferNeeded = new Event<
    [string, string, RTCSessionDescriptionInit]
  >();
  readonly onSubscriptionReady = new Event<[DataSubscription]>();
  readonly onRemotePublicationAdded = new Event<[RemotePublication]>();
  readonly onRemotePublicationRemoved = new Event<[string]>();
  readonly onDataChannelMessage = new Event<[string]>();
  readonly onDataChannelError = new Event<[any]>();

  constructor(
    private connectionManager: ConnectionManager,
    private memberId: string,
    private jsonRpc?: JsonRpc,
  ) {}

  setJsonRpc(jsonRpc: JsonRpc): void {
    this.jsonRpc = jsonRpc;
  }

  async subscribeData(
    publicationId: string,
    options: { timeout?: number } = {},
  ): Promise<DataSubscription> {
    // Check for existing subscription
    const existingSubscription = Array.from(
      this.dataSubscriptions.values(),
    ).find((sub) => sub.publicationId === publicationId);

    if (existingSubscription) {
      throw new Error(
        `Already subscribed to media publication ${publicationId}`,
      );
    }

    await this.connectionManager.waitForConnection();

    if (!this.jsonRpc) {
      throw new Error("JsonRpc not initialized");
    }

    try {
      this.jsonRpc
        .request("subscribe", {
          publicationId: publicationId,
        })
        .then((response) => {
          console.log(
            `Subscribe request successful for publication ${publicationId}:`,
            response,
          );
        });

      const [subscription] = await this.onSubscriptionReady.watch(
        (s) => s.publicationId === publicationId,
        5000,
      );

      await subscription.waitForOpen(5000);

      return subscription;
    } catch (error) {
      console.error(
        `Subscribe request failed for publication ${publicationId}:`,
        error,
      );
      throw new Error(
        `Failed to subscribe: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async subscribeMedia(publicationId: string): Promise<MediaSubscription> {
    // Check for existing media subscription to the same publication
    const existingSubscription = Array.from(
      this.mediaSubscriptions.values(),
    ).find((sub) => sub.publicationId === publicationId);

    if (existingSubscription) {
      throw new Error(
        `Already subscribed to media publication ${publicationId}`,
      );
    }

    // Wait for control channel to be connected before creating media subscription
    await this.connectionManager.waitForConnection();

    const subscriptionId = uuidv4();
    const subscription = new MediaSubscription(subscriptionId, publicationId);

    return new Promise(async (resolve, reject) => {
      let resolved = false;

      const trackReadyUnsubscribe = subscription.onTrackReady.subscribe(() => {
        if (!resolved) {
          resolved = true;
          trackReadyUnsubscribe.unSubscribe();
          resolve(subscription);
        }
      });

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          trackReadyUnsubscribe.unSubscribe();
          this.pendingMediaSubscriptions.delete(subscriptionId);
          reject(
            new Error(
              `Media subscription timeout for publication ${publicationId}`,
            ),
          );
        }
      }, 10000);

      this.pendingMediaSubscriptions.set(subscriptionId, {
        resolve: () => {
          clearTimeout(timeout);
        },
        reject: (error: Error) => {
          if (!resolved) {
            resolved = true;
            trackReadyUnsubscribe.unSubscribe();
            clearTimeout(timeout);
            reject(error);
          }
        },
        subscription,
      });

      try {
        if (!this.jsonRpc) {
          throw new Error("JsonRpc not initialized");
        }
        const response = await this.jsonRpc.request("subscribeMedia", {
          publicationId: publicationId,
          subscriptionId: subscriptionId,
        });

        console.log(`SubscribeMedia request successful:`, response);
      } catch (error) {
        console.error(`SubscribeMedia request failed:`, error);
        resolved = true;
        trackReadyUnsubscribe.unSubscribe();
        clearTimeout(timeout);
        this.pendingMediaSubscriptions.delete(subscriptionId);
        reject(error);
      }
    });
  }

  getSubscription(publicationId: string): DataSubscription | undefined {
    return Array.from(this.dataSubscriptions.values()).find(
      (sub) => sub.publicationId === publicationId,
    );
  }

  getMediaSubscription(subscriptionId: string): MediaSubscription | undefined {
    return this.mediaSubscriptions.get(subscriptionId);
  }

  getSubscriptions(): DataSubscription[] {
    return Array.from(this.dataSubscriptions.values());
  }

  getMediaSubscriptions(): MediaSubscription[] {
    return Array.from(this.mediaSubscriptions.values());
  }

  getDataSubscriptions(): DataSubscription[] {
    return Array.from(this.dataSubscriptions.values());
  }

  async unsubscribeData(publicationId: string): Promise<void> {
    const subscription = this.dataSubscriptions.get(publicationId);
    if (!subscription) {
      throw new Error(`Data subscription ${publicationId} not found`);
    }

    subscription.close();
    this.dataSubscriptions.delete(publicationId);
  }

  removeSubscription(publicationId: string): void {
    this.dataSubscriptions.delete(publicationId);
  }

  getRemotePublications(): RemotePublication[] {
    const dataPublications = Array.from(this.remoteDataPublications.values());
    const mediaPublications = Array.from(this.remoteMediaPublications.values());
    return [...dataPublications, ...mediaPublications];
  }

  handleDataChannel(channel: RTCDataChannel): void {
    if (channel.label.startsWith("sub_")) {
      this.handleSubscriptionDataChannel(channel);
    } else {
      this.handleGenericDataChannel(channel);
    }
  }

  handleTrack(event: RTCTrackEvent): void {
    let subscriptionId: string | null = null;
    for (const stream of event.streams) {
      if (stream.id?.startsWith("sub_")) {
        subscriptionId = stream.id.substring(4);
        break;
      }
    }

    if (!subscriptionId) {
      console.error("No subscription ID found in track streams");
      return;
    }

    const pending = this.pendingMediaSubscriptions.get(subscriptionId);
    if (!pending) {
      console.error(`No pending subscription found for ID: ${subscriptionId}`);
      return;
    }

    pending.subscription.setTrack(
      event.track as MediaStreamTrackLike,
      event.transceiver,
    );
    this.mediaSubscriptions.set(subscriptionId, pending.subscription);
    pending.resolve(pending.subscription);
    this.pendingMediaSubscriptions.delete(subscriptionId);
  }

  async handleSubscribeOffer(
    subscriptionId: string,
    publicationId: string,
    offer: RTCSessionDescriptionInit,
  ): Promise<void> {
    console.log(
      `[handleSubscribeOffer] Starting for sub=${subscriptionId}, pub=${publicationId}`,
    );
    const pending = this.pendingMediaSubscriptions.get(subscriptionId);
    if (!pending) {
      console.error(
        `No pending media subscription found for ${subscriptionId}`,
      );
      console.log(
        `[DEBUG] Current pending subscriptions:`,
        Array.from(this.pendingMediaSubscriptions.keys()),
      );
      return;
    }
    console.log(
      `[handleSubscribeOffer] Found pending subscription for ${subscriptionId}`,
    );

    try {
      await this.connectionManager.setRemoteDescription(offer);
      const answer = await this.connectionManager.createAndSetAnswer();

      if (!this.jsonRpc) {
        throw new Error("JsonRpc not initialized");
      }

      try {
        const response = await this.jsonRpc.request("subscribeAnswer", {
          subscriptionId: subscriptionId,
          answer: {
            type: answer.type,
            sdp: answer.sdp,
          },
        });

        console.log(
          `SubscribeAnswer request successful for subscription ${subscriptionId}:`,
          response,
        );
      } catch (requestError) {
        console.error(
          `SubscribeAnswer request failed for subscription ${subscriptionId}:`,
          requestError,
        );
        pending.reject(requestError as Error);
        this.pendingMediaSubscriptions.delete(subscriptionId);
        return;
      }
    } catch (error) {
      pending.reject(error as Error);
      this.pendingMediaSubscriptions.delete(subscriptionId);
    }
  }

  handleRemotePublication(publication: RemotePublication): void {
    // Track remote publication if it's not from this client
    if (publication.publisher !== this.memberId) {
      if (publication.type === "data") {
        this.remoteDataPublications.set(publication.id, publication);
      } else {
        this.remoteMediaPublications.set(publication.id, publication);
      }
    }
    this.onRemotePublicationAdded.execute(publication);
  }

  handleMemberLeft(memberId: string): void {
    // Clean up remote publications from the member who left
    for (const [pubId, remotePub] of this.remoteDataPublications.entries()) {
      if (remotePub.publisher === memberId) {
        this.remoteDataPublications.delete(pubId);
      }
    }
    for (const [pubId, remotePub] of this.remoteMediaPublications.entries()) {
      if (remotePub.publisher === memberId) {
        this.remoteMediaPublications.delete(pubId);
        this.onRemotePublicationRemoved.execute(pubId);
      }
    }
  }

  handleMediaUnpublished(publicationId: string): void {
    this.remoteMediaPublications.delete(publicationId);
    this.onRemotePublicationRemoved.execute(publicationId);
  }

  private handleSubscriptionDataChannel(channel: RTCDataChannel): void {
    const publicationId = channel.label.substring(4); // Remove "sub_" prefix
    const subscription = new DataSubscription(
      channel.label,
      publicationId,
      channel,
    );

    this.dataSubscriptions.set(publicationId, subscription);
    console.log(`Created subscription for publication ${publicationId}`);
    this.onSubscriptionReady.execute(subscription);
  }

  private handleGenericDataChannel(channel: RTCDataChannel): void {
    // Generic data channel handling for channels that are not subscriptions
    channel.onopen = () => channel.send("ping");
    channel.onmessage = ({ data }) => this.onDataChannelMessage.execute(data);
    channel.onerror = (error) => this.onDataChannelError.execute(error);
  }

  close(): void {
    // Close data subscriptions
    for (const subscription of this.dataSubscriptions.values()) {
      subscription.close();
    }
    this.dataSubscriptions.clear();

    // Close media subscriptions
    for (const subscription of this.mediaSubscriptions.values()) {
      subscription.close();
    }
    this.mediaSubscriptions.clear();

    // Reject pending subscriptions
    for (const pending of this.pendingMediaSubscriptions.values()) {
      pending.reject(new Error("Subscriber closed"));
    }
    this.pendingMediaSubscriptions.clear();

    // Clear remote publications
    this.remoteDataPublications.clear();
    this.remoteMediaPublications.clear();

    // Complete events
    this.onSubscribeOfferNeeded.complete();
    this.onSubscriptionReady.complete();
    this.onRemotePublicationAdded.complete();
    this.onRemotePublicationRemoved.complete();
    this.onDataChannelMessage.complete();
    this.onDataChannelError.complete();
  }
}
