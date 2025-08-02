import { Event } from "../../../submodules/werift/packages/common/src/event.js";
import { PromiseQueue } from "../../../submodules/werift/packages/common/src/promise.js";
import { MessageAssemblerTransport } from "./adapters/messageAssemblerTransport.js";
import { ConnectionManager } from "./connectionManager.js";
import type { DataPublication } from "./dataPublication.js";
import type { DataSubscription } from "./dataSubscription.js";
import { JsonRpc } from "./imports/json-rpc.js";
import { MessageAssembler } from "./imports/util.js";
import type { MediaPublication } from "./mediaPublication.js";
import type { MediaSubscription } from "./mediaSubscription.js";
import { Publisher } from "./publisher.js";
import { type RemotePublication, Subscriber } from "./subscriber.js";
import type { MediaStreamTrackLike } from "./type.js";

export type { RemotePublication } from "./subscriber.js";

export interface RemoteMember {
  id: string;
  name?: string;
  metadata?: Record<string, any>;
}

export interface ClientConfig {
  peerConnection?: any;
  iceServers?: RTCIceServer[];
}

export class Client {
  id!: string;

  // Delegate instances
  private connectionManager: ConnectionManager;
  private publisher!: Publisher;
  private subscriber!: Subscriber;

  // Control Channel
  private controlChannel: RTCDataChannel | null = null;
  private messageAssembler = new MessageAssembler();
  private jsonRpc: JsonRpc | null = null;
  private connected: boolean = false;
  private pingInterval: NodeJS.Timeout | number | null = null;
  private publishQueue = new PromiseQueue();
  private publishMediaQueue = new PromiseQueue();
  private subscribeQueue = new PromiseQueue();
  private subscribeMediaQueue = new PromiseQueue();
  private controlQueue = new PromiseQueue();

  // Remote members tracking
  private remoteMembers = new Map<string, RemoteMember>();

  // Events
  readonly onControlMessage = new Event<[string]>();
  readonly onPublicationReady = new Event<[RemotePublication]>();
  readonly onMediaPublicationReady = new Event<[RemotePublication]>();
  readonly onMediaUnpublished = new Event<[string]>(); // publicationId
  readonly onDataUnpublished = new Event<[string]>(); // publicationId
  readonly onDataUnsubscribed = new Event<[string]>(); // publicationId
  readonly onDataChannelMessage = new Event<[string]>();
  readonly onDataChannelError = new Event<[any]>();
  readonly onSubscriptionReady = new Event<[DataSubscription]>();
  readonly onMemberLeft = new Event<[string]>();
  readonly onMemberJoined = new Event<
    [{ memberId: string; name?: string; metadata?: Record<string, any> }]
  >();
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

  // Delegation properties
  get peerConnection(): RTCPeerConnection {
    return this.connectionManager.getPeerConnection();
  }

  private constructor(config: ClientConfig = {}) {
    // Initialize ConnectionManager
    this.connectionManager = new ConnectionManager(config);

    // Initialize Publisher (JsonRpc will be set later)
    this.publisher = new Publisher(this.connectionManager);

    // Note: Subscriber will be initialized after ID is set in init()
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
    this.id = memberId;
    this.connectionManager.memberId = memberId;

    // Initialize Subscriber now that we have the member ID
    this.subscriber = new Subscriber(this.connectionManager, this.id);

    // Set up event forwarding
    this.setupEventForwarding();

    // Set remote description
    await this.connectionManager.setRemoteDescription(offer);
  }

  private setupEventForwarding(): void {
    // ConnectionManager events
    this.connectionManager.onDataChannel.subscribe((channel) => {
      if (channel.label.startsWith("sfu")) {
        this.setControlChannel(channel);
      } else {
        this.subscriber.handleDataChannel(channel);
      }
    });

    this.connectionManager.onTrack.subscribe((event) => {
      this.subscriber.handleTrack(event);
    });

    this.connectionManager.onIceCandidate.subscribe((candidate) => {
      this.onIceCandidate.execute(candidate);
    });

    this.connectionManager.onConnectionStateChange.subscribe((state) => {
      this.onConnectionStateChange.execute(state);
    });

    this.connectionManager.onConnected.subscribe(() => {
      this.connected = true;
      this._onConnected.execute();
    });

    // Note: Publisher and Subscriber events will be set up in setupPublisherSubscriberEvents
    // after they are initialized in setupJsonRpc
  }

  // Integrated Control Channel Methods
  private setControlChannel(channel: RTCDataChannel): void {
    this.controlChannel = channel;
    this.setupControlChannelHandlers();
    this.setupJsonRpc();
  }

  private setupControlChannelHandlers(): void {
    if (!this.controlChannel) return;

    this.controlChannel.onopen = () => {
      console.log("[Client] Control channel opened, starting ping interval");
      this.startPingInterval();
    };

    this.controlChannel.onerror = () => {};
    this.controlChannel.onclose = () => {
      this.stopPingInterval();
      if (this.jsonRpc) {
        this.jsonRpc.close().catch(console.error);
      }
    };
  }

  private setupJsonRpc(): void {
    if (!this.controlChannel) return;

    const transport = new MessageAssemblerTransport(this.controlChannel);
    this.jsonRpc = new JsonRpc(transport);

    // Set JsonRpc on Publisher and Subscriber now that it's available
    this.publisher.setJsonRpc(this.jsonRpc);
    this.subscriber.setJsonRpc(this.jsonRpc);

    // Set up Publisher and Subscriber events
    this.setupPublisherSubscriberEvents();

    // Set up JSON RPC notification handlers for messages from server
    this.jsonRpc.onNotification("controlChannelReady", (params) => {
      this.handleControlChannelReady(params);
    });

    this.jsonRpc.onNotification("publicationReady", (params) => {
      this.handlePublicationReady(params);
    });

    this.jsonRpc.onNotification("mediaPublicationReady", (params) => {
      this.handleMediaPublicationReady(params);
    });

    this.jsonRpc.onNotification("mediaUnpublished", (params) => {
      this.handleMediaUnpublished(params);
    });

    this.jsonRpc.onNotification("dataUnpublished", (params) => {
      this.handleDataUnpublished(params);
    });

    this.jsonRpc.onNotification("memberJoined", (params) => {
      this.handleMemberJoined(params);
    });

    this.jsonRpc.onNotification("memberLeft", (params) => {
      this.handleMemberLeft(params);
    });

    this.jsonRpc.onNotification("offer", (params) => {
      this.handleOffer(params);
    });

    this.jsonRpc.onNotification("subscribeOffer", (params) => {
      this.handleSubscribeOffer(params);
    });

    this.jsonRpc.onNotification("subscribeError", (params) => {
      this.handleSubscribeError(params);
    });
  }

  private setupPublisherSubscriberEvents(): void {
    // Publisher events
    this.publisher.onPublicationReady.subscribe(() => {
      // This will be handled by control message processing
    });

    // Subscriber events
    this.subscriber.onSubscriptionReady.subscribe((subscription) => {
      this.onSubscriptionReady.execute(subscription);
    });

    this.subscriber.onRemotePublicationAdded.subscribe((publication) => {
      if (publication.type === "data") {
        this.onPublicationReady.execute(publication);
      } else {
        this.onMediaPublicationReady.execute(publication);
      }
    });

    this.subscriber.onRemotePublicationRemoved.subscribe((publicationId) => {
      this.onMediaUnpublished.execute(publicationId);
    });

    this.subscriber.onDataChannelMessage.subscribe((data) => {
      this.onDataChannelMessage.execute(data);
    });

    this.subscriber.onDataChannelError.subscribe((error) => {
      this.onDataChannelError.execute(error);
    });
  }

  // Individual JSON RPC notification handlers
  private handleControlChannelReady(params: any) {
    console.log("JSON RPC notification received: controlChannelReady", params);
    this.controlQueue
      .push(async () => {
        if (this.connected) {
          return;
        }
        this.connectionManager.setConnected(true);
      })
      .catch(console.error);
  }

  private handlePublicationReady(params: any) {
    console.log("JSON RPC notification received: publicationReady", params);
    this.controlQueue
      .push(async () => {
        if (!params?.publicationId) return;

        const remotePublication: RemotePublication = {
          id: params.publicationId,
          publisher: params.publisherMemberId!,
          type: params.mediaType || "data",
          metadata: params.metadata || {},
        };

        // Handle publication ready for local publications
        if (params.publisherMemberId === this.id) {
          this.publisher.handlePublicationReady(params.publicationId);
        }

        // Handle remote publication
        this.subscriber.handleRemotePublication(remotePublication);
      })
      .catch(console.error);
  }

  private handleMediaPublicationReady(params: any) {
    console.log(
      "JSON RPC notification received: mediaPublicationReady",
      params,
    );
    this.controlQueue
      .push(async () => {
        if (!params?.publicationId) return;

        const remotePublication: RemotePublication = {
          id: params.publicationId,
          publisher: params.publisherMemberId!,
          type: params.mediaType || "audio",
          metadata: params.metadata || {},
        };

        // Handle remote publication
        this.subscriber.handleRemotePublication(remotePublication);
      })
      .catch(console.error);
  }

  private handleMediaUnpublished(params: any) {
    console.log("JSON RPC notification received: mediaUnpublished", params);
    this.controlQueue
      .push(async () => {
        if (!params?.publicationId) return;

        const publicationId = params.publicationId;
        console.log(`Media unpublished: ${publicationId}`);
        this.subscriber.handleMediaUnpublished(publicationId);
      })
      .catch(console.error);
  }

  private handleDataUnpublished(params: any) {
    console.log("JSON RPC notification received: dataUnpublished", params);
    this.controlQueue
      .push(async () => {
        if (!params?.publicationId) return;

        const publicationId = params.publicationId;
        console.log(`Data unpublished: ${publicationId}`);

        // Remove from local publications if this client was the publisher
        if (params.publisherMemberId === this.id) {
          this.publisher.handleDataUnpublished(publicationId);
        }

        // Remove subscription if we were subscribed to this publication
        const subscription = this.subscriber.getSubscription(publicationId);
        if (subscription) {
          subscription.close();
          this.subscriber.removeSubscription(publicationId);
          this.onDataUnsubscribed.execute(publicationId);
        }

        // Notify listeners
        this.onDataUnpublished.execute(publicationId);
      })
      .catch(console.error);
  }

  private handleMemberJoined(params: any) {
    console.log("JSON RPC notification received: memberJoined", params);
    this.controlQueue
      .push(async () => {
        if (!params?.memberId) return;

        const remoteMember: RemoteMember = {
          id: params.memberId,
          name: params.name,
          metadata: params.metadata,
        };
        this.remoteMembers.set(params.memberId, remoteMember);
        this.onMemberJoined.execute({
          memberId: params.memberId,
          name: params.name,
          metadata: params.metadata,
        });
      })
      .catch(console.error);
  }

  private handleMemberLeft(params: any) {
    console.log("JSON RPC notification received: memberLeft", params);
    this.controlQueue
      .push(async () => {
        if (!params?.memberId) return;

        const leftMemberId = params.memberId;

        // Delegate to subscriber for publication cleanup
        this.subscriber.handleMemberLeft(leftMemberId);

        // Remove the member from tracking
        this.remoteMembers.delete(leftMemberId);
        this.onMemberLeft.execute(params.memberId);
      })
      .catch(console.error);
  }

  private handleOffer(params: any) {
    console.log("JSON RPC notification received: offer");
    this.controlQueue
      .push(async () => {
        if (!params?.publicationId || !params?.offer) return;

        await this.publisher.handlePublishOffer(
          params.publicationId,
          params.offer,
        );
      })
      .catch(console.error);
  }

  private handleSubscribeOffer(params: any) {
    console.log("JSON RPC notification received: subscribeOffer");
    this.controlQueue
      .push(async () => {
        if (!params?.subscriptionId || !params?.publicationId || !params?.offer)
          return;

        await this.subscriber.handleSubscribeOffer(
          params.subscriptionId,
          params.publicationId,
          params.offer,
        );
      })
      .catch(console.error);
  }

  private handleSubscribeError(params: any) {
    console.log("JSON RPC notification received: subscribeError", params);
    this.controlQueue
      .push(async () => {
        if (!params?.error) return;

        console.error(`Subscription error: ${params.error}`);
        // The error will be handled by the pending subscription promise
      })
      .catch(console.error);
  }

  private startPingInterval(): void {
    if (this.pingInterval) {
      return; // Already started
    }

    this.pingInterval = setInterval(() => {
      this.sendPing().catch(console.error);
    }, 100);
  }

  private async sendPing(): Promise<void> {
    if (!this.jsonRpc) return;

    try {
      // Use JSON RPC request for ping (only request/response message type)
      await this.jsonRpc.request("ping", {
        timestamp: Date.now(),
      });
    } catch (error) {}
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  async createAndSetAnswer(): Promise<RTCSessionDescriptionInit> {
    return this.connectionManager.createAndSetAnswer();
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    return this.connectionManager.addIceCandidate(candidate);
  }

  close(): void {
    // Stop ping interval
    this.stopPingInterval();

    // Close delegated components
    this.publisher.close();
    this.subscriber.close();
    this.connectionManager.close();

    // Clear remote members tracking
    this.remoteMembers.clear();

    // Close JSON RPC
    if (this.jsonRpc) {
      this.jsonRpc.close().catch(console.error);
      this.jsonRpc = null;
    }

    // Close control channel
    if (this.controlChannel) {
      this.controlChannel.close();
    }
    this.messageAssembler.cleanup();

    // Complete all events
    this.onControlMessage.complete();
    this.onPublicationReady.complete();
    this.onMediaPublicationReady.complete();
    this.onMediaUnpublished.complete();
    this.onDataUnpublished.complete();
    this.onDataChannelMessage.complete();
    this.onDataChannelError.complete();
    this.onSubscriptionReady.complete();
    this.onMemberLeft.complete();
    this.onMemberJoined.complete();
    this.onIceCandidate.complete();
    this.onConnectionStateChange.complete();
    this._onConnected.complete();
  }

  isConnected(): boolean {
    return this.connectionManager.isConnected();
  }

  /**
   * Creates a new data publication channel for sending data to other participants in the room.
   *
   * This method establishes a WebRTC data channel that allows sending arbitrary data to other
   * room participants who subscribe to this publication. The data channel is created with
   * ordered delivery to ensure message ordering.
   *
   * @param {Record<string, any>} metadata - Optional metadata to associate with the publication
   *
   * @returns {Promise<DataPublication>} A promise that resolves to a DataPublication instance
   *   when the publication is ready to send data. The publication can be used to send messages
   *   via `publication.send(data)`.
   *
   * @throws {Error} If the control channel is not connected within 10 seconds
   * @throws {Error} If the publication is not ready within 10 seconds after creation
   *
   * @example
   * ```typescript
   * const publication = await client.publish();
   * publication.send("Hello, room!");
   *
   * // With metadata
   * const publication = await client.publish({ name: "chat", priority: "high" });
   * ```
   */
  async publishData(
    metadata: Record<string, any> = {},
  ): Promise<DataPublication> {
    return this.publishQueue.push(() => this.publisher.publish(metadata));
  }

  /**
   * Unpublishes a data publication that was previously created with publishData.
   *
   * This method removes the data publication from the room, closing the associated
   * data channel and notifying other participants that the publication is no longer
   * available. Subscribers to this publication will be automatically cleaned up.
   *
   * @param {string} publicationId - The ID of the publication to unpublish
   *
   * @returns {Promise<void>} A promise that resolves when the publication has been
   *   successfully unpublished and all cleanup operations are complete.
   *
   * @throws {Error} If the publication doesn't exist or unpublishing fails
   *
   * @example
   * ```typescript
   * const publication = await client.publishData({ name: "chat" });
   * // ... use the publication
   * await client.unpublishData(publication.publicationId);
   * ```
   */
  async unpublishData(publicationId: string): Promise<void> {
    return this.publishQueue.push(() =>
      this.publisher.unpublish(publicationId),
    );
  }

  getPublication(publicationId: string): DataPublication | undefined {
    return this.publisher.getPublication(publicationId);
  }

  getPublications(): (DataPublication | RemotePublication)[] {
    const localPublications = this.publisher.getPublications();
    const remotePublications = this.subscriber
      .getRemotePublications()
      .filter((pub) => pub.type === "data");
    return [...localPublications, ...remotePublications];
  }

  async subscribeData(publicationId: string): Promise<DataSubscription> {
    if (this.publisher.getPublication(publicationId)) {
      throw new Error("Cannot subscribe to your own publication");
    }
    return this.subscribeQueue.push(() =>
      this.subscriber.subscribeData(publicationId),
    );
  }

  getSubscription(publicationId: string): DataSubscription | undefined {
    return this.subscriber.getSubscription(publicationId);
  }

  getSubscriptions(): DataSubscription[] {
    return this.subscriber.getSubscriptions();
  }

  /**
   * Creates a new media publication for streaming audio or video to other participants in the room.
   *
   * This method publishes a MediaStreamTrack (audio or video) that can be received by other
   * room participants who subscribe to this publication. The track is transmitted via WebRTC
   * media channels with real-time streaming capabilities.
   *
   * @param {MediaStreamTrack | MediaStreamTrackLike} track - The media track to publish.
   *   Can be an audio track (from microphone) or video track (from camera). The track's
   *   `kind` property ("audio" or "video") determines the media type.
   * @param {Record<string, any>} metadata - Optional metadata to associate with the publication
   *
   * @returns {Promise<MediaPublication>} A promise that resolves to a MediaPublication instance
   *   when the media publication is established and ready to stream. Other participants can
   *   then subscribe to receive this media stream.
   *
   * @throws {Error} If the control channel is not connected within 10 seconds
   * @throws {Error} If the media publication is not ready within 10 seconds after creation
   * @throws {Error} If sending the publish request fails
   *
   * @example
   * ```typescript
   * // Publish video from camera
   * const stream = await navigator.mediaDevices.getUserMedia({ video: true });
   * const videoTrack = stream.getVideoTracks()[0];
   * const publication = await client.publishMedia(videoTrack);
   *
   * // Publish audio from microphone with metadata
   * const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
   * const audioTrack = audioStream.getAudioTracks()[0];
   * const audioPublication = await client.publishMedia(audioTrack, { name: "main-audio" });
   * ```
   */
  async publishMedia(
    track: MediaStreamTrack | MediaStreamTrackLike,
    metadata: Record<string, any> = {},
  ): Promise<MediaPublication> {
    return this.publishMediaQueue.push(() =>
      this.publisher.publishMedia(track, metadata),
    );
  }

  getMediaPublication(publicationId: string): MediaPublication | undefined {
    return this.publisher.getMediaPublication(publicationId);
  }

  getMediaPublications(): (MediaPublication | RemotePublication)[] {
    const localPublications = this.publisher.getMediaPublications();
    const remotePublications = this.subscriber
      .getRemotePublications()
      .filter((pub) => pub.type !== "data");
    return [...localPublications, ...remotePublications];
  }

  /**
   * Unpublish a media track that was previously published
   * @param publicationId - The ID of the publication to unpublish
   * @example
   * ```typescript
   * // Unpublish a previously published media track
   * await client.unpublishMedia(audioPublication.publicationId);
   * ```
   */
  async unpublishMedia(publicationId: string): Promise<void> {
    return this.publisher.unpublishMedia(publicationId);
  }

  async subscribeMedia(publicationId: string): Promise<MediaSubscription> {
    if (this.publisher.getMediaPublication(publicationId)) {
      throw new Error("Cannot subscribe to your own publication");
    }
    return this.subscribeMediaQueue.push(() => {
      return this.subscriber.subscribeMedia(publicationId);
    });
  }

  getMediaSubscription(subscriptionId: string): MediaSubscription | undefined {
    return this.subscriber.getMediaSubscription(subscriptionId);
  }

  getMediaSubscriptions(): MediaSubscription[] {
    return this.subscriber.getMediaSubscriptions();
  }

  async unsubscribeData(publicationId: string): Promise<void> {
    return this.subscriber.unsubscribeData(publicationId);
  }

  getDataSubscriptions(): DataSubscription[] {
    return this.subscriber.getDataSubscriptions();
  }

  /**
   * Retrieves the list of remote members currently in the room.
   *
   * This method returns an array of RemoteMember objects representing all other
   * participants in the room (excluding the current client). Each RemoteMember
   * contains the member's ID, optional name, and optional metadata.
   *
   * @returns {RemoteMember[]} An array of remote members currently in the room.
   *   Returns an empty array if no other members are present.
   *
   * @example
   * ```typescript
   * const remoteMembers = client.getRemoteMembers();
   * console.log(`There are ${remoteMembers.length} other members in the room`);
   *
   * for (const member of remoteMembers) {
   *   console.log(`Member: ${member.name || member.id}`);
   *   if (member.metadata) {
   *     console.log(`Metadata:`, member.metadata);
   *   }
   * }
   * ```
   */
  getRemoteMembers(): RemoteMember[] {
    return Array.from(this.remoteMembers.values());
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
