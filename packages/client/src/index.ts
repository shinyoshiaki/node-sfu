import { v4 as uuidv4 } from "uuid";
import { Event } from "../../../submodules/werift/packages/common/src/event.js";
import { DataPublication } from "./dataPublication.js";
import { DataSubscription } from "./dataSubscription.js";
import { MediaPublication } from "./mediaPublication.js";
import { MediaSubscription } from "./mediaSubscription.js";
import type { MediaStreamTrackLike } from "./type.js";
import {
  MessageAssembler,
  type MessageEnvelope,
  decompressMessage,
  prepareMessagesForSending,
} from "./utils/compression.js";

export const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

export interface ClientConfig {
  peerConnection?: any;
  iceServers?: RTCIceServer[];
}

interface ControlMessage {
  type: string;
  payload?: {
    publicationId?: string;
    subscriptionId?: string;
    publisherMemberId?: string;
    memberId?: string;
    offer?: RTCSessionDescriptionInit;
    answer?: RTCSessionDescriptionInit;
    mediaKind?: string;
    error?: string;
  };
}

interface PendingMediaPublication {
  resolve: (publication: MediaPublication) => void;
  reject: (error: Error) => void;
  track: MediaStreamTrackLike;
}

interface PendingMediaSubscription {
  resolve: (subscription: MediaSubscription) => void;
  reject: (error: Error) => void;
  subscription: MediaSubscription;
}

export class Client {
  peerConnection: RTCPeerConnection;

  // Integrated Control Channel functionality
  private controlChannel: RTCDataChannel | null = null;
  private messageAssembler = new MessageAssembler();
  private connected: boolean = false;

  // Integrated Data Channel functionality
  private dataPublications = new Map<string, DataPublication>();
  private dataSubscriptions = new Map<string, DataSubscription>();
  private pendingDataPublications = new Map<
    string,
    {
      resolve: (publication: DataPublication) => void;
      reject: (error: Error) => void;
      publication: DataPublication;
    }
  >();

  // Integrated Media functionality
  private mediaPublications = new Map<string, MediaPublication>();
  private mediaSubscriptions = new Map<string, MediaSubscription>();
  private pendingMediaPublications = new Map<string, PendingMediaPublication>();
  private pendingMediaSubscriptions = new Map<
    string,
    PendingMediaSubscription
  >();

  // Events
  readonly onControlMessage = new Event<[string]>();
  readonly onPublicationReady = new Event<[string]>();
  readonly onMediaPublicationReady = new Event<[string, string]>();
  readonly onMediaPublishOffer = new Event<
    [string, RTCSessionDescriptionInit]
  >();
  readonly onMediaSubscribeOffer = new Event<
    [string, string, RTCSessionDescriptionInit]
  >();
  readonly onDataChannelMessage = new Event<[string]>();
  readonly onDataChannelError = new Event<[any]>();
  readonly onSubscriptionReady = new Event<[DataSubscription]>();
  readonly onMemberLeft = new Event<[string]>();
  readonly onIceCandidate = new Event<[RTCIceCandidate]>();
  readonly onConnectionStateChange = new Event<[RTCPeerConnectionState]>();
  readonly _onConnected = new Event<[]>();

  get onConnected(): Event<[]> {
    if (this.connected) {
      setTimeout(() => {
        this._onConnected.execute();
      }, 0);
    }
    return this._onConnected;
  }

  private constructor(config: ClientConfig = {}) {
    if (config.peerConnection) {
      this.peerConnection = config.peerConnection;
    } else {
      const iceServers = config.iceServers || ICE_SERVERS;
      this.peerConnection = new RTCPeerConnection({
        iceServers: iceServers,
      });
    }

    this.setupPeerConnectionHandlers();
    this.setupMediaEventHandlers();
  }

  static async create(
    offer: RTCSessionDescriptionInit,
    memberId: string,
    config: ClientConfig = {},
  ): Promise<Client> {
    const client = new Client(config);
    await client.init(offer, memberId);
    return client;
  }

  private async init(
    offer: RTCSessionDescriptionInit,
    memberId: string,
  ): Promise<void> {
    // Check if we're in a browser environment with RTCSessionDescription
    if (typeof RTCSessionDescription !== "undefined") {
      this.peerConnection
        .setRemoteDescription(new RTCSessionDescription(offer))
        .catch((error) => {
          console.error("Failed to set remote description:", error);
        });
    } else {
      // For werift or other environments, pass the offer directly
      this.peerConnection.setRemoteDescription(offer).catch((error) => {
        console.error("Failed to set remote description:", error);
      });
    }
  }

  private setupPeerConnectionHandlers(): void {
    this.peerConnection.ondatachannel = ({ channel }) => {
      if (channel.label.startsWith("sfu")) {
        this.setControlChannel(channel);
      } else {
        this.handleDataChannel(channel);
      }
    };

    this.peerConnection.ontrack = (event) => {
      this.handleIncomingTrack(event);
    };

    this.setupIceCandidateHandler();
    this.setupConnectionStateHandler();
  }

  private setupMediaEventHandlers(): void {
    this.onMediaPublishOffer.subscribe((publicationId, offer) => {
      this.handlePublishOffer(publicationId, offer);
    });

    this.onMediaSubscribeOffer.subscribe(
      (subscriptionId, publicationId, offer) => {
        this.handleSubscribeOffer(subscriptionId, publicationId, offer);
      },
    );
  }

  // Integrated Control Channel Methods
  private setControlChannel(channel: RTCDataChannel): void {
    this.controlChannel = channel;
    this.setupControlChannelHandlers();
  }

  private setupControlChannelHandlers(): void {
    if (!this.controlChannel) return;

    this.controlChannel.onmessage = async ({ data }) => {
      try {
        let envelopeText: string;
        if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
          const uint8Array =
            data instanceof ArrayBuffer ? new Uint8Array(data) : data;
          envelopeText = await decompressMessage(uint8Array);
        } else {
          envelopeText = data as string;
        }

        const envelope: MessageEnvelope = JSON.parse(envelopeText);
        const reconstructedMessage =
          this.messageAssembler.processMessage(envelope);

        if (reconstructedMessage !== null) {
          this.onControlMessage.execute(reconstructedMessage);
          this.handleControlMessage(reconstructedMessage);
        }
      } catch (error) {
        console.error("Failed to decompress control message:", error);
      }
    };

    this.controlChannel.onerror = () => {};
    this.controlChannel.onclose = () => {};
  }

  private handleControlMessage(data: string): void {
    try {
      const envelope: ControlMessage = JSON.parse(data);
      console.log("Control message received:", envelope);

      if (envelope.type === "controlChannelReady") {
        if (this.connected) {
          return;
        }
        this.connected = true;
        this._onConnected.execute();
      } else if (
        envelope.type === "publicationReady" &&
        envelope.payload?.publicationId
      ) {
        this.onPublicationReady.execute(envelope.payload.publicationId);
      } else if (
        envelope.type === "mediaPublicationReady" &&
        envelope.payload?.publicationId
      ) {
        this.onMediaPublicationReady.execute(
          envelope.payload.publicationId,
          envelope.payload.publisherMemberId!,
        );
      } else if (
        envelope.type === "offer" &&
        envelope.payload?.publicationId &&
        envelope.payload?.offer
      ) {
        this.onMediaPublishOffer.execute(
          envelope.payload.publicationId,
          envelope.payload.offer,
        );
      } else if (
        envelope.type === "subscribeOffer" &&
        envelope.payload?.subscriptionId &&
        envelope.payload?.publicationId &&
        envelope.payload?.offer
      ) {
        this.onMediaSubscribeOffer.execute(
          envelope.payload.subscriptionId,
          envelope.payload.publicationId,
          envelope.payload.offer,
        );
      } else if (envelope.type === "memberLeft" && envelope.payload?.memberId) {
        this.onMemberLeft.execute(envelope.payload.memberId);
      }
    } catch (error) {}
  }

  private async sendControlMessage(message: any): Promise<void> {
    if (this.controlChannel && this.controlChannel.readyState === "open") {
      try {
        const messageText = JSON.stringify(message);
        const compressedMessages = await prepareMessagesForSending(messageText);

        // Send all fragments
        for (const compressedData of compressedMessages) {
          this.controlChannel.send(compressedData);
        }
      } catch (error) {
        console.error("Failed to compress and send control message:", error);
        throw error;
      }
    } else {
      throw new Error("Control channel is not open");
    }
  }

  // Integrated Data Channel Methods
  private handleDataChannel(channel: RTCDataChannel): void {
    if (channel.label.startsWith("sub_")) {
      this.handleSubscriptionDataChannel(channel);
    } else {
      this.handleGenericDataChannel(channel);
    }
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
    channel.onopen = () => channel.send("ping");
    channel.onmessage = ({ data }) => this.onDataChannelMessage.execute(data);
    channel.onerror = (error) => this.onDataChannelError.execute(error);
  }

  async createAndSetAnswer(): Promise<RTCSessionDescriptionInit> {
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return {
      type: this.peerConnection.localDescription!.type,
      sdp: this.peerConnection.localDescription!.sdp,
    };
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (typeof RTCIceCandidate !== "undefined") {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      await this.peerConnection.addIceCandidate(candidate);
    }
  }

  private setupIceCandidateHandler(): void {
    this.peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.onIceCandidate.execute(candidate);
      }
    };
  }

  private setupConnectionStateHandler(): void {
    this.peerConnection.onconnectionstatechange = () => {
      this.onConnectionStateChange.execute(this.peerConnection.connectionState);
    };
  }

  // Integrated Media Methods
  private async handlePublishOffer(
    publicationId: string,
    offer: RTCSessionDescriptionInit,
  ): Promise<void> {
    console.log(`Handling publish offer for ${publicationId}`, offer);
    const pending = this.pendingMediaPublications.get(publicationId);
    if (!pending) {
      console.error(`No pending media publication found for ${publicationId}`);
      return;
    }

    try {
      this.peerConnection.addTrack(pending.track as MediaStreamTrack);
      // Check if we're in a browser environment with RTCSessionDescription
      if (typeof RTCSessionDescription !== "undefined") {
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(offer),
        );
      } else {
        // For werift or other environments, pass the offer directly
        await this.peerConnection.setRemoteDescription(offer);
      }

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      const message = {
        type: "answer",
        payload: {
          publicationId: publicationId,
          answer: {
            type: answer.type,
            sdp: answer.sdp,
          },
        },
      };
      await this.sendControlMessage(message);

      const publication = new MediaPublication(publicationId, pending.track);
      this.mediaPublications.set(publicationId, publication);

      pending.resolve(publication);
      this.pendingMediaPublications.delete(publicationId);
    } catch (error) {
      pending.reject(error as Error);
      this.pendingMediaPublications.delete(publicationId);
    }
  }

  private async handleSubscribeOffer(
    subscriptionId: string,
    publicationId: string,
    offer: RTCSessionDescriptionInit,
  ): Promise<void> {
    const pending = this.pendingMediaSubscriptions.get(subscriptionId);
    if (!pending) {
      console.error(
        `No pending media subscription found for ${subscriptionId}`,
      );
      return;
    }

    try {
      // Check if we're in a browser environment with RTCSessionDescription
      if (typeof RTCSessionDescription !== "undefined") {
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(offer),
        );
      } else {
        // For werift or other environments, pass the offer directly
        await this.peerConnection.setRemoteDescription(offer);
      }

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      const message = {
        type: "subscribeAnswer",
        payload: {
          subscriptionId: subscriptionId,
          answer: {
            type: answer.type,
            sdp: answer.sdp,
          },
        },
      };
      await this.sendControlMessage(message);
    } catch (error) {
      pending.reject(error as Error);
      this.pendingMediaSubscriptions.delete(subscriptionId);
    }
  }

  private handleIncomingTrack(event: RTCTrackEvent): void {
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
    this.pendingMediaSubscriptions.delete(subscriptionId);
  }

  close(): void {
    // Close data subscriptions and publications
    for (const subscription of this.dataSubscriptions.values()) {
      subscription.close();
    }
    this.dataSubscriptions.clear();

    for (const publication of this.dataPublications.values()) {
      publication.close();
    }
    this.dataPublications.clear();

    for (const pending of this.pendingDataPublications.values()) {
      pending.reject(new Error("Client closed"));
    }
    this.pendingDataPublications.clear();

    // Close media subscriptions and publications
    for (const subscription of this.mediaSubscriptions.values()) {
      subscription.close();
    }
    this.mediaSubscriptions.clear();

    this.mediaPublications.clear();

    for (const pending of this.pendingMediaSubscriptions.values()) {
      pending.reject(new Error("Client closed"));
    }
    this.pendingMediaSubscriptions.clear();

    for (const pending of this.pendingMediaPublications.values()) {
      pending.reject(new Error("Client closed"));
    }
    this.pendingMediaPublications.clear();

    // Close control channel
    if (this.controlChannel) {
      this.controlChannel.close();
    }
    this.messageAssembler.cleanup();

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    // Complete all events
    this.onControlMessage.complete();
    this.onPublicationReady.complete();
    this.onMediaPublicationReady.complete();
    this.onMediaPublishOffer.complete();
    this.onMediaSubscribeOffer.complete();
    this.onDataChannelMessage.complete();
    this.onDataChannelError.complete();
    this.onSubscriptionReady.complete();
    this.onMemberLeft.complete();
    this.onIceCandidate.complete();
    this.onConnectionStateChange.complete();
    this._onConnected.complete();
  }

  isConnected(): boolean {
    return this.peerConnection.connectionState === "connected";
  }

  async publish(): Promise<DataPublication> {
    // Wait for control channel to be connected before creating publication
    if (!this.connected) {
      await this.onConnected.asPromise(10000);
    }

    const publicationId = uuidv4();
    const label = `pub_${publicationId}`;

    const channel = this.peerConnection.createDataChannel(label, {
      ordered: true,
    });

    const publication = new DataPublication(publicationId, channel);
    this.dataPublications.set(publicationId, publication);

    return new Promise((resolve, reject) => {
      this.pendingDataPublications.set(publicationId, {
        resolve,
        reject,
        publication,
      });

      const timeout = setTimeout(() => {
        this.pendingDataPublications.delete(publicationId);
        reject(new Error(`Publication ready timeout for ${publicationId}`));
      }, 10000);

      const unsubscribe = this.onPublicationReady.subscribe(
        (readyPublicationId) => {
          if (readyPublicationId === publicationId) {
            clearTimeout(timeout);
            unsubscribe.unSubscribe();
            this.pendingDataPublications.delete(publicationId);
            resolve(publication);
          }
        },
      );
    });
  }

  getPublication(publicationId: string): DataPublication | undefined {
    return this.dataPublications.get(publicationId);
  }

  getPublications(): DataPublication[] {
    return Array.from(this.dataPublications.values());
  }

  async subscribe(publicationId: string): Promise<void> {
    // Wait for control channel to be connected before subscribing
    if (!this.connected) {
      await this.onConnected.asPromise(10000);
    }

    const message = {
      type: "subscribe",
      payload: {
        publicationId: publicationId,
      },
    };
    await this.sendControlMessage(message);
    console.log(`Sent subscribe request for publication ${publicationId}`);

    await this.onSubscriptionReady.watch(
      (s) => s.publicationId === publicationId,
      10000,
      "Subscription ready timeout",
    );
  }

  getSubscription(publicationId: string): DataSubscription | undefined {
    return Array.from(this.dataSubscriptions.values()).find(
      (sub) => sub.publicationId === publicationId,
    );
  }

  getSubscriptions(): DataSubscription[] {
    return Array.from(this.dataSubscriptions.values());
  }

  async publishMedia(
    track: MediaStreamTrack | MediaStreamTrackLike,
  ): Promise<MediaPublication> {
    // Wait for control channel to be connected before creating media publication
    if (!this.connected) {
      await this.onConnected.asPromise(10000);
    }
    console.log(`Publishing media track: ${track.kind}`);

    const publicationId = uuidv4();

    return new Promise(async (resolve, reject) => {
      let resolved = false;

      const pendingResolve = (publication: MediaPublication) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(publication);
        }
      };

      const pendingReject = (error: Error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(error);
        }
      };

      this.pendingMediaPublications.set(publicationId, {
        resolve: pendingResolve,
        reject: pendingReject,
        track: track as MediaStreamTrackLike,
      });

      const timeout = setTimeout(() => {
        if (!resolved) {
          this.pendingMediaPublications.delete(publicationId);
          pendingReject(
            new Error(`Media publication ready timeout for ${publicationId}`),
          );
        }
      }, 10000);

      try {
        const message = {
          type: "publishMedia",
          payload: {
            publicationId: publicationId,
            mediaKind: track.kind, // Use track.kind to specify media type
          },
        };
        console.log(
          `Sending publish request for ${publicationId} with media kind ${track.kind}`,
        );
        await this.sendControlMessage(message);
      } catch (error) {
        this.pendingMediaPublications.delete(publicationId);
        pendingReject(error as Error);
      }
    });
  }

  getMediaPublication(publicationId: string): MediaPublication | undefined {
    return this.mediaPublications.get(publicationId);
  }

  getMediaPublications(): MediaPublication[] {
    return Array.from(this.mediaPublications.values());
  }

  async subscribeMedia(publicationId: string): Promise<MediaSubscription> {
    // Wait for control channel to be connected before creating media subscription
    if (!this.connected) {
      await this.onConnected.asPromise(10000);
    }

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
        const message = {
          type: "subscribeMedia",
          payload: {
            publicationId: publicationId,
            subscriptionId: subscriptionId,
          },
        };
        await this.sendControlMessage(message);
      } catch (error) {
        resolved = true;
        trackReadyUnsubscribe.unSubscribe();
        clearTimeout(timeout);
        this.pendingMediaSubscriptions.delete(subscriptionId);
        reject(error);
      }
    });
  }

  getMediaSubscription(subscriptionId: string): MediaSubscription | undefined {
    return this.mediaSubscriptions.get(subscriptionId);
  }

  getMediaSubscriptions(): MediaSubscription[] {
    return Array.from(this.mediaSubscriptions.values());
  }

  // Add dispose method for hierarchical cleanup
  dispose(): void {
    this.close();
  }
}

export { DataPublication } from "./dataPublication.js";
export { DataSubscription } from "./dataSubscription.js";
export { MediaPublication } from "./mediaPublication.js";
export { MediaSubscription } from "./mediaSubscription.js";
