import { randomUUID } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import type { MediaKind } from "werift/nonstandard";
import { MessageAssemblerTransport } from "./adapters/messageAssemblerTransport.js";
import { DataPublication, parseDataChannelLabel } from "./dataPublication.js";
import { DataSubscription } from "./dataSubscription.js";
import {
  JsonRpc,
  JsonRpcErrorCode,
  JsonRpcException,
} from "./imports/json-rpc.js";
import { MessageAssembler } from "./imports/util.js";
import {
  Event,
  EventDisposer,
  PromiseQueue,
  type RTCDataChannel,
  RTCPeerConnection,
  type RTCSessionDescriptionInit,
} from "./imports/werift.js";
import { MediaPublication } from "./mediaPublication.js";
import { MediaSubscription } from "./mediaSubscription.js";

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
    metadata?: Record<string, any>;
  };
}

export class Member {
  readonly memberId: string;
  readonly name?: string;
  readonly metadata?: Record<string, any>;

  // Events for dependency injection
  readonly onDataPublicationReady = new Event<
    [publicationId: string, publisherMemberId: string]
  >();
  readonly onMediaPublicationReady = new Event<
    [publicationId: string, publisherMemberId: string]
  >();
  readonly onMediaUnpublished = new Event<
    [publicationId: string, publisherMemberId: string]
  >();
  readonly onDataUnpublished = new Event<
    [publicationId: string, publisherMemberId: string]
  >();
  readonly onMediaSubscriptionReady = new Event<
    [subscription: MediaSubscription]
  >();
  readonly onSubscriptionForwardingRequest = new Event<
    [publicationId: string, subscription: DataSubscription]
  >();
  readonly onSubscriptionValidationRequest = new Event<
    [publicationId: string, resolve: (exists: boolean) => void]
  >();
  readonly onMediaSubscriptionValidationRequest = new Event<
    [publicationId: string, resolve: (exists: boolean) => void]
  >();
  readonly onExistingPublicationsRequest = new Event<[]>();
  readonly onExistingMembersRequest = new Event<[]>();
  readonly onMediaSubscriptionRequest = new Event<
    [
      publicationId: string,
      subscriptionId: string,
      subscription: MediaSubscription,
    ]
  >();
  readonly onDisconnected = new Event<[memberId: string]>();
  readonly onControlChannelReady = new Event();

  // Ping management
  private hasReceivedFirstPing = false;

  // Integrated PeerConnection functionality
  peerConnection: RTCPeerConnection;
  private readonly promiseQueue = new PromiseQueue();

  // Integrated Control Channel functionality
  private controlChannel: RTCDataChannel | null = null;
  private messageAssembler = new MessageAssembler();
  private jsonRpc: JsonRpc | null = null;
  private readonly disposer = new EventDisposer();

  // Integrated Data Channel functionality
  dataPublications = new Map<string, DataPublication>();
  private dataSubscriptions = new Map<string, DataSubscription>();

  // Integrated Media functionality
  private mediaPublications = new Map<string, MediaPublication>();
  private pendingMediaPublications = new Map<string, MediaPublication>();
  private mediaSubscriptions = new Map<string, MediaSubscription>();

  // External dependencies injected via constructor - removed to fix dependency direction

  constructor(
    options: {
      iceServers?: Array<{ urls: string }>;
      name?: string;
      metadata?: Record<string, any>;
    } = {},
  ) {
    const {
      iceServers = [{ urls: "stun:stun.l.google.com:19302" }],
      name,
      metadata,
    } = options;

    this.memberId = uuidv4();
    this.name = name;
    this.metadata = metadata;

    // Initialize PeerConnection
    this.peerConnection = new RTCPeerConnection({
      iceServers,
      bundlePolicy: "max-bundle",
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
    this.setupJsonRpc();
  }

  private setupControlChannelHandlers(): void {
    if (!this.controlChannel) return;

    this.controlChannel.onOpen.subscribe(() => {
      console.log(
        `[Member] Control channel opened for member ${this.memberId}`,
      );
      console.log(
        `[Member] Calling onControlChannelOpen callback for member ${this.memberId}`,
      );

      // Notify room that control channel is ready for member joined broadcast
      this.onControlChannelReady.execute();

      const interval = setTimeout(() => {
        this.sendControlChannelReady().catch(console.error);
      }, 1000);
      this.disposer.push(() => {
        clearTimeout(interval);
      });
    });

    this.controlChannel.onClose.subscribe(() => {
      console.log(`Control channel closed for member ${this.memberId}`);
      this.onDisconnected.execute(this.memberId);
      this.messageAssembler.cleanup();
      if (this.jsonRpc) {
        this.jsonRpc.close().catch(console.error);
      }
      this.cleanup();
      this.disposer.dispose();
    });
  }

  private setupJsonRpc(): void {
    if (!this.controlChannel) return;

    const transport = new MessageAssemblerTransport(this.controlChannel);
    this.jsonRpc = new JsonRpc(transport);

    // Set up JSON RPC request handler for ping
    this.jsonRpc.onRequest("ping", async (params) => {
      await this.handlePing();
      return {
        timestamp: params?.timestamp,
        serverTime: Date.now(),
      };
    });

    // Set up JSON RPC request handlers
    this.jsonRpc.onRequest("subscribe", async (params) => {
      if (!params?.publicationId) {
        throw new JsonRpcException(
          JsonRpcErrorCode.INVALID_PARAMS,
          "Invalid params: publicationId is required",
        );
      }
      return await this.handleSubscribe(params.publicationId);
    });

    this.jsonRpc.onRequest("publishMedia", async (params) => {
      if (!params?.publicationId || !params?.mediaKind) {
        throw new JsonRpcException(
          JsonRpcErrorCode.INVALID_PARAMS,
          "Invalid params: publicationId and mediaKind are required",
        );
      }
      return await this.handlePublishMedia(
        params.publicationId,
        params.mediaKind,
        params.metadata || {},
      );
    });

    this.jsonRpc.onRequest("unpublishMedia", async (params) => {
      if (!params?.publicationId) {
        throw new JsonRpcException(
          JsonRpcErrorCode.INVALID_PARAMS,
          "Invalid params: publicationId is required",
        );
      }
      return await this.handleUnpublishMedia(params.publicationId);
    });

    this.jsonRpc.onRequest("unpublishData", async (params) => {
      if (!params?.publicationId) {
        throw new JsonRpcException(
          JsonRpcErrorCode.INVALID_PARAMS,
          "Invalid params: publicationId is required",
        );
      }
      return await this.handleUnpublishData(params.publicationId);
    });

    this.jsonRpc.onRequest("answer", async (params) => {
      if (!params?.publicationId || !params?.answer) {
        throw new JsonRpcException(
          JsonRpcErrorCode.INVALID_PARAMS,
          "Invalid params: publicationId and answer are required",
        );
      }
      return await this.handleMediaPublishAnswer(
        params.publicationId,
        params.answer,
      );
    });

    this.jsonRpc.onRequest("subscribeMedia", async (params) => {
      if (!params?.publicationId || !params?.subscriptionId) {
        throw new JsonRpcException(
          JsonRpcErrorCode.INVALID_PARAMS,
          "Invalid params: publicationId and subscriptionId are required",
        );
      }
      return await this.handleSubscribeMedia(
        params.publicationId,
        params.subscriptionId,
      );
    });

    this.jsonRpc.onRequest("subscribeAnswer", async (params) => {
      if (!params?.subscriptionId || !params?.answer) {
        throw new JsonRpcException(
          JsonRpcErrorCode.INVALID_PARAMS,
          "Invalid params: subscriptionId and answer are required",
        );
      }
      return await this.handleMediaSubscribeAnswer(
        params.subscriptionId,
        params.answer,
      );
    });
  }

  private async handlePing(): Promise<void> {
    if (!this.hasReceivedFirstPing) {
      this.hasReceivedFirstPing = true;
      console.log(`[Member] First ping received from member ${this.memberId}`);
      // Send existing publications now that client is confirmed ready
      this.sendExistingPublications();
    }
  }

  private handleIncomingDataChannel(channel: RTCDataChannel): void {
    if (channel.label.startsWith("pub_")) {
      const { publicationId, metadata } = parseDataChannelLabel(channel.label);
      console.log(
        "Received publication data channel:",
        channel.label,
        "publicationId:",
        publicationId,
        "metadata:",
        metadata,
      );

      const publication = new DataPublication(
        publicationId,
        this.memberId,
        channel,
        metadata,
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
    if (!this.jsonRpc) {
      console.warn(
        `JSON RPC not ready for member ${this.memberId}. Message not sent:`,
        message,
      );
      return;
    }

    try {
      // Convert old message format to JSON RPC notification
      const method = message.type;
      const params = message.payload;

      this.jsonRpc.notify(method, params);

      if (message.type !== "controlChannelReady") {
        console.log(`Sent JSON RPC notification to member ${this.memberId}:`, {
          method,
          params,
        });
      }
    } catch (error) {
      console.error("Failed to send JSON RPC notification:", error);
    }
  }

  private async sendControlChannelReady(): Promise<void> {
    if (this.jsonRpc) {
      this.jsonRpc.notify("controlChannelReady", {
        memberId: this.memberId,
      });
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
  private async handleSubscribe(
    publicationId: string,
  ): Promise<{ success: boolean; subscriptionId?: string; timestamp: number }> {
    // Check for existing subscription
    if (this.dataSubscriptions.has(publicationId)) {
      console.warn(
        `Member ${this.memberId} already has a subscription to publication ${publicationId}`,
      );
      throw new JsonRpcException(
        JsonRpcErrorCode.SUBSCRIPTION_FAILED,
        "Already subscribed to this publication",
        { publicationId },
      );
    }

    // Validate that the publication exists before creating subscription
    const publicationExists = await new Promise<boolean>((resolve) => {
      this.onSubscriptionValidationRequest.execute(publicationId, resolve);
    });

    if (!publicationExists) {
      console.warn(
        `Publication ${publicationId} not found for member ${this.memberId}`,
      );
      throw new JsonRpcException(
        JsonRpcErrorCode.PUBLICATION_NOT_FOUND,
        "Publication not found",
        { publicationId },
      );
    }

    try {
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

      return {
        success: true,
        subscriptionId: subscriptionLabel,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(
        `Failed to create subscription for ${publicationId}:`,
        error,
      );
      throw new JsonRpcException(
        JsonRpcErrorCode.SUBSCRIPTION_FAILED,
        "Failed to create subscription",
        {
          publicationId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  // Media Management Methods
  async handlePublishMedia(
    publicationId: string,
    kind: MediaKind,
    metadata: Record<string, any> = {},
  ): Promise<{
    success: boolean;
    offer?: RTCSessionDescriptionInit;
    timestamp: number;
  }> {
    try {
      const publication = new MediaPublication(
        publicationId,
        this.memberId,
        kind,
        metadata,
      );
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

      return {
        success: true,
        offer: offer,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(
        `Failed to handle publishMedia for ${publicationId}:`,
        error,
      );
      this.pendingMediaPublications.delete(publicationId);
      throw new JsonRpcException(
        JsonRpcErrorCode.MEDIA_PUBLISH_FAILED,
        "Failed to publish media",
        {
          publicationId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  async handleUnpublishMedia(
    publicationId: string,
  ): Promise<{ success: boolean; timestamp: number }> {
    try {
      let unpublished = false;

      // Remove from media publications
      const publication = this.mediaPublications.get(publicationId);
      if (publication) {
        // Stop the track if it exists
        if (publication.track) {
          publication.track.stop();
        }
        // Dispose the publication
        publication.dispose();
        this.mediaPublications.delete(publicationId);
        unpublished = true;

        console.log(
          `Unpublished media ${publicationId} for member ${this.memberId}`,
        );

        // Notify room about unpublished media
        this.onMediaUnpublished.execute(publicationId, this.memberId);
      }

      // Also check pending publications
      const pendingPublication =
        this.pendingMediaPublications.get(publicationId);
      if (pendingPublication) {
        pendingPublication.dispose();
        this.pendingMediaPublications.delete(publicationId);
        unpublished = true;
      }

      if (!unpublished) {
        console.warn(`No media publication found for ${publicationId}`);
        throw new JsonRpcException(
          JsonRpcErrorCode.PUBLICATION_NOT_FOUND,
          "Publication not found",
          { publicationId },
        );
      }

      return {
        success: true,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(
        `Failed to handle unpublishMedia for ${publicationId}:`,
        error,
      );
      if (error && typeof error === "object" && "code" in error) {
        throw error; // Re-throw JSON-RPC errors
      }
      throw new JsonRpcException(
        JsonRpcErrorCode.MEDIA_PUBLISH_FAILED,
        "Failed to unpublish media",
        {
          publicationId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  async handleUnpublishData(
    publicationId: string,
  ): Promise<{ success: boolean; timestamp: number }> {
    try {
      const publication = this.dataPublications.get(publicationId);
      if (!publication) {
        console.warn(`No data publication found for ${publicationId}`);
        throw new JsonRpcException(
          JsonRpcErrorCode.PUBLICATION_NOT_FOUND,
          "Data publication not found",
          { publicationId },
        );
      }

      // Dispose the publication
      publication.dispose();
      this.dataPublications.delete(publicationId);

      console.log(
        `Unpublished data ${publicationId} for member ${this.memberId}`,
      );

      // Notify room about unpublished data
      this.onDataUnpublished.execute(publicationId, this.memberId);

      return {
        success: true,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(
        `Failed to handle unpublishData for ${publicationId}:`,
        error,
      );
      if (error && typeof error === "object" && "code" in error) {
        throw error; // Re-throw JSON-RPC errors
      }
      throw new JsonRpcException(
        JsonRpcErrorCode.MEDIA_PUBLISH_FAILED,
        "Failed to unpublish data",
        {
          publicationId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  async handleMediaPublishAnswer(
    publicationId: string,
    answer: RTCSessionDescriptionInit,
  ): Promise<{ success: boolean; timestamp: number }> {
    try {
      const publication = this.pendingMediaPublications.get(publicationId);
      if (!publication) {
        throw new JsonRpcException(
          JsonRpcErrorCode.PUBLICATION_NOT_FOUND,
          "No pending media publication found",
          { publicationId },
        );
      }

      await this.accept(answer);

      return {
        success: true,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(`Failed to handle answer for ${publicationId}:`, error);
      this.pendingMediaPublications.delete(publicationId);
      if (error && typeof error === "object" && "code" in error) {
        throw error; // Re-throw JSON-RPC errors
      }
      throw new JsonRpcException(
        JsonRpcErrorCode.MEDIA_PUBLISH_FAILED,
        "Failed to handle media publish answer",
        {
          publicationId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  async handleSubscribeMedia(
    publicationId: string,
    subscriptionId: string,
  ): Promise<{ success: boolean; subscriptionId: string; timestamp: number }> {
    console.log(
      `[handleSubscribeMedia] Starting for pub=${publicationId}, sub=${subscriptionId}`,
    );
    try {
      // Check for existing media subscription to the same publication
      const existingSubscription = Array.from(
        this.mediaSubscriptions.values(),
      ).find((sub) => sub.publicationId === publicationId);

      if (existingSubscription) {
        console.warn(
          `Member ${this.memberId} already has a media subscription to publication ${publicationId}`,
        );
        throw new JsonRpcException(
          JsonRpcErrorCode.SUBSCRIPTION_FAILED,
          "Already subscribed to this media publication",
          { publicationId, subscriptionId },
        );
      }

      // Validate that the media publication exists before creating subscription
      const mediaPublicationExists = await new Promise<boolean>((resolve) => {
        this.onMediaSubscriptionValidationRequest.execute(
          publicationId,
          resolve,
        );
      });

      if (!mediaPublicationExists) {
        console.warn(
          `Media publication ${publicationId} not found for member ${this.memberId}`,
        );
        throw new JsonRpcException(
          JsonRpcErrorCode.PUBLICATION_NOT_FOUND,
          "Media publication not found",
          { publicationId, subscriptionId },
        );
      }

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

      return {
        success: true,
        subscriptionId: subscriptionId,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(
        `Failed to handle subscribeMedia for ${publicationId}:`,
        error,
      );
      if (error && typeof error === "object" && "code" in error) {
        throw error; // Re-throw JSON-RPC errors
      }
      throw new JsonRpcException(
        JsonRpcErrorCode.SUBSCRIPTION_FAILED,
        "Failed to subscribe to media",
        {
          publicationId,
          subscriptionId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  async handleMediaSubscribeAnswer(
    subscriptionId: string,
    answer: RTCSessionDescriptionInit,
  ): Promise<{ success: boolean; timestamp: number }> {
    try {
      const subscription = this.mediaSubscriptions.get(subscriptionId);
      if (!subscription) {
        throw new JsonRpcException(
          JsonRpcErrorCode.SUBSCRIPTION_FAILED,
          "Unknown subscription",
          { subscriptionId },
        );
      }

      await this.accept(answer);

      this.onMediaSubscriptionReady.execute(subscription);

      console.log(
        `Media subscription ${subscriptionId} for publication ${subscription.publicationId} is ready`,
      );

      return {
        success: true,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(
        `Failed to handle subscribe answer for ${subscriptionId}:`,
        error,
      );
      this.mediaSubscriptions.delete(subscriptionId);
      if (error && typeof error === "object" && "code" in error) {
        throw error; // Re-throw JSON-RPC errors
      }
      throw new JsonRpcException(
        JsonRpcErrorCode.SUBSCRIPTION_FAILED,
        "Failed to handle media subscribe answer",
        {
          subscriptionId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  private sendExistingPublications(): void {
    // Request existing publications from Room via event
    this.onExistingPublicationsRequest.execute();
    // Request existing members from Room via event
    this.onExistingMembersRequest.execute();
  }

  // Add dispose method for hierarchical cleanup
  dispose(): void {
    this.cleanup();

    // Complete all events
    this.onDataPublicationReady.complete();
    this.onMediaPublicationReady.complete();
    this.onMediaUnpublished.complete();
    this.onDataUnpublished.complete();
    this.onMediaSubscriptionReady.complete();
    this.onSubscriptionForwardingRequest.complete();
    this.onSubscriptionValidationRequest.complete();
    this.onMediaSubscriptionValidationRequest.complete();
    this.onExistingPublicationsRequest.complete();
    this.onExistingMembersRequest.complete();
    this.onMediaSubscriptionRequest.complete();
    this.onDisconnected.complete();
    this.onControlChannelReady.complete();
  }
}
