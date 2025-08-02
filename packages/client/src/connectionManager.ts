import { Event } from "../../../submodules/werift/packages/common/src/event.js";
import { PromiseQueue } from "../../../submodules/werift/packages/common/src/promise.js";
import type { ClientConfig } from "./index.js";

export const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

export class ConnectionManager {
  private queue = new PromiseQueue();
  private peerConnection: RTCPeerConnection;
  private connected: boolean = false;
  private pingInterval: NodeJS.Timeout | number | null = null;

  // Events
  readonly onDataChannel = new Event<[RTCDataChannel]>();
  readonly onTrack = new Event<[RTCTrackEvent]>();
  readonly onIceCandidate = new Event<[RTCIceCandidate]>();
  readonly onConnectionStateChange = new Event<[RTCPeerConnectionState]>();
  readonly onConnected = new Event<[]>();
  memberId!: string;

  constructor(config: ClientConfig = {}) {
    if (config.peerConnection) {
      this.peerConnection = config.peerConnection;
    } else {
      const iceServers = config.iceServers || ICE_SERVERS;
      this.peerConnection = new RTCPeerConnection({
        iceServers: iceServers,
      });
    }

    this.setupPeerConnectionHandlers();
  }

  getPeerConnection(): RTCPeerConnection {
    return this.peerConnection;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async waitForConnection(timeout: number = 10000): Promise<void> {
    if (this.connected) return;
    await this.onConnected.asPromise(timeout);
  }

  setConnected(connected: boolean): void {
    if (this.connected !== connected) {
      this.connected = connected;
      if (connected) {
        this.onConnected.execute();
      }
    }
  }

  async setRemoteDescription(offer: RTCSessionDescriptionInit): Promise<void> {
    return this.queue.push(async () => {
      // Check if we're in a browser environment with RTCSessionDescription
      if (typeof RTCSessionDescription !== "undefined") {
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(offer),
        );
      } else {
        // For werift or other environments, pass the offer directly
        await this.peerConnection.setRemoteDescription(offer);
      }
    });
  }

  async createAndSetAnswer(): Promise<RTCSessionDescriptionInit> {
    return this.queue.push(async () => {
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      return {
        type: this.peerConnection.localDescription!.type,
        sdp: this.peerConnection.localDescription!.sdp,
      };
    });
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (typeof RTCIceCandidate !== "undefined") {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      await this.peerConnection.addIceCandidate(candidate);
    }
  }

  private setupPeerConnectionHandlers(): void {
    this.peerConnection.ondatachannel = ({ channel }) => {
      this.onDataChannel.execute(channel);
    };

    this.peerConnection.ontrack = (event) => {
      this.onTrack.execute(event);
    };

    this.setupIceCandidateHandler();
    this.setupConnectionStateHandler();
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

  close(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
    }

    // Complete all events
    this.onDataChannel.complete();
    this.onTrack.complete();
    this.onIceCandidate.complete();
    this.onConnectionStateChange.complete();
    this.onConnected.complete();
  }
}
