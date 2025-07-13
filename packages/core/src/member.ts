import { randomUUID } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import type { MediaKind } from "werift/nonstandard";
import {
  Event,
  EventDisposer,
  PromiseQueue,
  type RTCDataChannel,
  RTCPeerConnection,
  type RTCSessionDescriptionInit,
} from "../../../submodules/werift/packages/webrtc/src/index.js";
import { DataPublication } from "./dataPublication.js";
import { DataSubscription } from "./dataSubscription.js";
import { MediaPublication } from "./mediaPublication.js";
import { MediaSubscription } from "./mediaSubscription.js";
import {
  MessageAssembler,
  type MessageEnvelope,
  decompressMessage,
  prepareMessagesForSending,
} from "./utils/compression.js";

export interface ControlMessage {
  type: string;
  payload?: {
    publicationId?: string;
    subscriptionId?: string;
    publisherMemberId?: string;
    memberId?: string;
    answer?: any;
    mediaKind?: MediaKind;
    offer?: RTCSessionDescriptionInit;
    error?: string;
  };
}

export class Member {
  readonly memberId: string;

  // Events for dependency injection
  readonly onDataPublicationReady = new Event<
    [publicationId: string, publisherMemberId: string]
  >();
  readonly onMediaPublicationReady = new Event<
    [publicationId: string, publisherMemberId: string]
  >();
  readonly onMediaSubscriptionReady = new Event<
    [subscription: MediaSubscription]
  >();
  readonly onSubscriptionForwardingRequest = new Event<
    [publicationId: string, subscription: DataSubscription]
  >();
  readonly onExistingPublicationsRequest = new Event<[]>();
  readonly onMediaSubscriptionRequest = new Event<
    [
      publicationId: string,
      subscriptionId: string,
      subscription: MediaSubscription,
    ]
  >();
  readonly onDisconnected = new Event<[memberId: string]>();

  // Integrated PeerConnection functionality
  peerConnection: RTCPeerConnection;
  private readonly promiseQueue = new PromiseQueue();

  // Integrated Control Channel functionality
  private controlChannel: RTCDataChannel | null = null;
  private messageAssembler = new MessageAssembler();
  private readonly disposer = new EventDisposer();

  // Integrated Data Channel functionality
  private dataPublications = new Map<string, DataPublication>();
  private dataSubscriptions = new Map<string, DataSubscription>();

  // Integrated Media functionality
  private mediaPublications = new Map<string, MediaPublication>();
  private pendingMediaPublications = new Map<string, MediaPublication>();
  private mediaSubscriptions = new Map<string, MediaSubscription>();

  // External dependencies injected via constructor - removed to fix dependency direction

  constructor(
    private readonly iceServers = [{ urls: "stun:stun.l.google.com:19302" }],
  ) {
    this.memberId = uuidv4();

    // Initialize PeerConnection
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers,
    });

    this.setupPeerConnection();
    this.setupDataChannelHandler();
    this.setupConnectionStateHandler();
  }

  private setupPeerConnection(): void {
    // Create control channel
    const controlChannel = this.peerConnection.createDataChannel(
      "sfu" + randomUUID(),
      {
        ordered: true,
      },
    );

    this.setControlChannel(controlChannel);
  }

  private setupDataChannelHandler(): void {
    this.peerConnection.onDataChannel.subscribe((channel) => {
      this.handleIncomingDataChannel(channel);
    });
  }

  private setControlChannel(channel: RTCDataChannel): void {
    this.controlChannel = channel;
    this.setupControlChannelHandlers();
  }

  private setupControlChannelHandlers(): void {
    if (!this.controlChannel) return;

    this.controlChannel.onMessage.subscribe(async (message) => {
      try {
        let envelopeText: string;
        if (message instanceof Uint8Array || Buffer.isBuffer(message)) {
          const uint8Array = Buffer.isBuffer(message)
            ? new Uint8Array(message)
            : message;
          envelopeText = await decompressMessage(uint8Array);
        } else {
          envelopeText = message as string;
        }

        const envelope: MessageEnvelope = JSON.parse(envelopeText);
        const reconstructedMessage =
          this.messageAssembler.processMessage(envelope);

        if (reconstructedMessage !== null) {
          const controlMessage = JSON.parse(reconstructedMessage);
          this.handleControlMessage(controlMessage);
        }
      } catch (error) {
        console.error("Failed to parse control message:", error);
      }
    });

    this.controlChannel.onOpen.subscribe(() => {
      console.log(
        `[Member] Control channel opened for member ${this.memberId}`,
      );
      console.log(
        `[Member] Calling onControlChannelOpen callback for member ${this.memberId}`,
      );
      this.sendExistingPublications();

      const interval = setTimeout(() => {
        this.sendControlMessage({
          type: "controlChannelReady",
          payload: {
            memberId: this.memberId,
          },
        }).catch(console.error);
      }, 1000);
      this.disposer.push(() => {
        clearTimeout(interval);
      });
    });

    this.controlChannel.onClose.subscribe(() => {
      console.log(`Control channel closed for member ${this.memberId}`);
      this.onDisconnected.execute(this.memberId);
      this.messageAssembler.cleanup();
      this.cleanup();
      this.disposer.dispose();
    });
  }

  private handleControlMessage(envelope: ControlMessage): void {
    if (envelope.type === "subscribe" && envelope.payload?.publicationId) {
      this.handleSubscribe(envelope.payload.publicationId);
    } else if (
      envelope.type === "publishMedia" &&
      envelope.payload?.publicationId
    ) {
      this.handlePublishMedia(
        envelope.payload.publicationId,
        envelope.payload.mediaKind!,
      );
    } else if (
      envelope.type === "answer" &&
      envelope.payload?.publicationId &&
      envelope.payload?.answer
    ) {
      this.handleMediaPublishAnswer(
        envelope.payload.publicationId,
        envelope.payload.answer,
      );
    } else if (
      envelope.type === "subscribeMedia" &&
      envelope.payload?.publicationId &&
      envelope.payload?.subscriptionId
    ) {
      this.handleSubscribeMedia(
        envelope.payload.publicationId,
        envelope.payload.subscriptionId,
      );
    } else if (
      envelope.type === "subscribeAnswer" &&
      envelope.payload?.subscriptionId &&
      envelope.payload?.answer
    ) {
      this.handleMediaSubscribeAnswer(
        envelope.payload.subscriptionId,
        envelope.payload.answer,
      );
    }
  }

  private handleIncomingDataChannel(channel: RTCDataChannel): void {
    if (channel.label.startsWith("pub_")) {
      const publicationId = channel.label.substring(4);
      console.log(
        "Received publication data channel:",
        channel.label,
        "publicationId:",
        publicationId,
      );

      const publication = new DataPublication(
        publicationId,
        this.memberId,
        channel,
      );
      this.dataPublications.set(publicationId, publication);

      this.onDataPublicationReady.execute(publicationId, this.memberId);

      channel.onOpen.subscribe(() => {
        console.log(`DataChannel for publication ${publicationId} is now open`);
      });
    }
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return this.promiseQueue.push(async () => {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      return this.peerConnection.localDescription!;
    });
  }

  async accept(answerSdp: RTCSessionDescriptionInit): Promise<void> {
    await this.promiseQueue.push(() =>
      this.peerConnection.setRemoteDescription(answerSdp),
    );
  }

  async addIceCandidate(candidate: any): Promise<void> {
    await this.peerConnection.addIceCandidate(candidate);
  }

  async sendControlMessage(message: any): Promise<void> {
    if (this.controlChannel && this.controlChannel.readyState === "open") {
      try {
        const messageText = JSON.stringify(message);
        const compressedMessages = await prepareMessagesForSending(messageText);

        // Send all fragments
        for (const compressedData of compressedMessages) {
          this.controlChannel.send(Buffer.from(compressedData));
        }

        if (message.type !== "controlChannelReady")
          console.log(
            `Sent control message to member ${this.memberId}:`,
            message,
          );
      } catch (error) {
        console.error("Failed to compress and send control message:", error);
      }
    } else {
      console.warn(
        `Cannot send control message to member ${this.memberId}: channel not ready`,
      );
    }
  }

  private setupConnectionStateHandler(): void {
    this.peerConnection.connectionStateChange.subscribe((state) => {
      console.log(
        `Member ${this.memberId} connection state changed to: ${state}`,
      );

      if (state === "disconnected" || state === "closed") {
        console.log(`Member ${this.memberId} disconnected (state: ${state})`);
        this.onDisconnected.execute(this.memberId);
      }
    });
  }

  cleanup(): void {
    // Clean up data publications and subscriptions using dispose()
    for (const publication of this.dataPublications.values()) {
      publication.dispose();
    }
    for (const subscription of this.dataSubscriptions.values()) {
      subscription.dispose();
    }
    this.dataPublications.clear();
    this.dataSubscriptions.clear();

    // Clean up media publications and subscriptions using dispose()
    for (const subscription of this.mediaSubscriptions.values()) {
      subscription.dispose();
    }
    for (const publication of this.mediaPublications.values()) {
      publication.dispose();
    }
    for (const publication of this.pendingMediaPublications.values()) {
      publication.dispose();
    }
    this.mediaSubscriptions.clear();
    this.mediaPublications.clear();
    this.pendingMediaPublications.clear();

    // Close peer connection
    this.peerConnection.close();

    // Clean up disposer
    this.disposer.dispose();
  }

  getDataPublication(publicationId: string): DataPublication | undefined {
    return this.dataPublications.get(publicationId);
  }

  getDataPublications(): DataPublication[] {
    return Array.from(this.dataPublications.values());
  }

  getDataSubscription(publicationId: string): DataSubscription | undefined {
    return this.dataSubscriptions.get(publicationId);
  }

  getDataSubscriptions(): DataSubscription[] {
    return Array.from(this.dataSubscriptions.values());
  }

  getMediaPublication(publicationId: string): MediaPublication | undefined {
    return this.mediaPublications.get(publicationId);
  }

  getMediaPublications(): MediaPublication[] {
    return Array.from(this.mediaPublications.values());
  }

  getAllMediaPublications(): MediaPublication[] {
    // Include both completed and pending media publications
    const all = [
      ...Array.from(this.mediaPublications.values()),
      ...Array.from(this.pendingMediaPublications.values()),
    ];
    return all;
  }

  getMediaSubscription(subscriptionId: string): MediaSubscription | undefined {
    return this.mediaSubscriptions.get(subscriptionId);
  }

  getMediaSubscriptions(): MediaSubscription[] {
    return Array.from(this.mediaSubscriptions.values());
  }

  get connectionState(): string {
    return this.peerConnection.connectionState;
  }

  // Data Channel Management Methods
  private handleSubscribe(publicationId: string): void {
    const subscriptionLabel = `sub_${publicationId}`;
    const subscriptionChannel = this.peerConnection.createDataChannel(
      subscriptionLabel,
      {
        ordered: true,
      },
    );

    const subscription = new DataSubscription(
      subscriptionLabel,
      publicationId,
      this.memberId,
      subscriptionChannel,
    );

    this.dataSubscriptions.set(publicationId, subscription);

    console.log(
      `Created subscription for member ${this.memberId} to publication ${publicationId}`,
    );

    this.onSubscriptionForwardingRequest.execute(publicationId, subscription);
  }

  // Media Management Methods
  async handlePublishMedia(
    publicationId: string,
    kind: MediaKind,
  ): Promise<void> {
    try {
      const publication = new MediaPublication(publicationId, this.memberId);
      const transceiver = this.peerConnection.addTransceiver(kind, {
        direction: "recvonly",
      });
      transceiver.onTrack.once((track) => {
        publication.setTrack(track, transceiver);
        this.mediaPublications.set(publicationId, publication);
        this.pendingMediaPublications.delete(publicationId);

        this.onMediaPublicationReady.execute(publicationId, this.memberId);
      });

      this.pendingMediaPublications.set(publicationId, publication);

      const offer = await this.createOffer();

      await this.sendControlMessage({
        type: "offer",
        payload: {
          publicationId: publicationId,
          offer: offer,
        },
      });
    } catch (error) {
      console.error(
        `Failed to handle publishMedia for ${publicationId}:`,
        error,
      );
      this.pendingMediaPublications.delete(publicationId);
    }
  }

  async handleMediaPublishAnswer(
    publicationId: string,
    answer: RTCSessionDescriptionInit,
  ): Promise<void> {
    try {
      const publication = this.pendingMediaPublications.get(publicationId);
      if (!publication) {
        console.error(
          `No pending media publication found for ${publicationId}`,
        );
        return;
      }

      await this.accept(answer);
    } catch (error) {
      console.error(`Failed to handle answer for ${publicationId}:`, error);
      this.pendingMediaPublications.delete(publicationId);
    }
  }

  async handleSubscribeMedia(
    publicationId: string,
    subscriptionId: string,
  ): Promise<void> {
    try {
      const subscription = new MediaSubscription(
        subscriptionId,
        publicationId,
        this.memberId,
      );

      this.mediaSubscriptions.set(subscriptionId, subscription);

      console.log(
        `Created media subscription ${subscriptionId} for member ${this.memberId} to publication ${publicationId}`,
      );

      // Request Room to set up media forwarding
      this.onMediaSubscriptionRequest.execute(
        publicationId,
        subscriptionId,
        subscription,
      );
    } catch (error) {
      console.error(
        `Failed to handle subscribeMedia for ${publicationId}:`,
        error,
      );
      await this.sendControlMessage({
        type: "subscribeError",
        payload: {
          subscriptionId: subscriptionId,
          error: (error as Error).message,
        },
      });
    }
  }

  async handleMediaSubscribeAnswer(
    subscriptionId: string,
    answer: RTCSessionDescriptionInit,
  ): Promise<void> {
    try {
      const subscription = this.mediaSubscriptions.get(subscriptionId);
      if (!subscription) {
        console.error(`Unknown subscription: ${subscriptionId}`);
        return;
      }

      await this.accept(answer);

      this.onMediaSubscriptionReady.execute(subscription);

      console.log(
        `Media subscription ${subscriptionId} for publication ${subscription.publicationId} is ready`,
      );
    } catch (error) {
      console.error(
        `Failed to handle subscribe answer for ${subscriptionId}:`,
        error,
      );
      this.mediaSubscriptions.delete(subscriptionId);
    }
  }

  private sendExistingPublications(): void {
    // Small delay to ensure the control channel is fully established on both sides
    setTimeout(() => {
      // Request existing publications from Room via event
      this.onExistingPublicationsRequest.execute();
    }, 100);
  }

  // Add dispose method for hierarchical cleanup
  dispose(): void {
    this.cleanup();

    // Complete all events
    this.onDataPublicationReady.complete();
    this.onMediaPublicationReady.complete();
    this.onMediaSubscriptionReady.complete();
    this.onSubscriptionForwardingRequest.complete();
    this.onExistingPublicationsRequest.complete();
    this.onMediaSubscriptionRequest.complete();
    this.onDisconnected.complete();
  }
}
