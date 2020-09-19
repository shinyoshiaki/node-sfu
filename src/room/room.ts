/* eslint-disable @typescript-eslint/ban-ts-comment */
import { v4 } from "uuid";
import {
  RTCPeerConnection,
  RTCSessionDescription,
  Kind,
  RTCIceCandidateJSON,
} from "werift";
import { Router } from "./router";

type RPC = { type: string; payload: any[] };

export class Room {
  router = new Router();
  peers: { [peerId: string]: RTCPeerConnection } = {};

  async join(): Promise<[string, RTCSessionDescription]> {
    const peerId = v4();
    const peer = (this.peers[peerId] = new RTCPeerConnection({
      stunServer: ["stun.l.google.com", 19302],
    }));

    peer.addTransceiver("video", "sendonly"); // dummy
    peer.createDataChannel("sfu").message.subscribe((msg) => {
      const { type, payload } = JSON.parse(msg as string) as RPC;
      //@ts-ignore
      this[type](...payload);
    });

    await peer.setLocalDescription(peer.createOffer());
    return [peerId, peer.localDescription];
  }

  // --------------------------------------------------------------------
  // RPC

  async handleAnswer(peerId: string, answer: RTCSessionDescription) {
    console.log("handleAnswer", peerId);
    const peer = this.peers[peerId];

    await peer.setRemoteDescription(answer);
  }

  handleCandidate(peerId: string, candidate: RTCIceCandidateJSON) {
    console.log("handleCandidate", peerId);
    const peer = this.peers[peerId];
    peer.addIceCandidate(candidate);
  }

  private publish = async (peerId: string, kinds: Kind[]) => {
    console.log("publish", peerId, kinds);
    const peer = this.peers[peerId];

    kinds
      .map((kind) => peer.addTransceiver(kind, "recvonly"))
      .forEach((transceiver) => {
        transceiver.onTrack.subscribe((track) => {
          const trackInfo = this.router.addTrack(peerId, track, transceiver);

          peer.iceConnectionStateChange.subscribe((state) => {
            console.log(peerId, state);
            if (state === "closed" || state === "disconnected") {
              this.router.removeTrack(peerId, trackInfo.mediaId);
            }
          });

          Object.values(this.peers).forEach((peer) => {
            this.sendRPC(
              {
                type: "handlePublish",
                payload: [trackInfo],
              },
              peer
            );
          });
        });
      });

    await this.sendOffer(peer);
  };

  private getTracks = (peerId: string) => {
    const peer = this.peers[peerId];
    this.sendRPC(
      {
        type: "handleTracks",
        payload: [this.router.trackInfos],
      },
      peer
    );
  };

  private subscribe = (peerId: string, trackIds: string[]) => {
    const peer = this.peers[peerId];
    trackIds
      .map((trackId) => {
        console.log({ trackId });
        const [peerId, mediaId] = trackId.split("_");
        return this.router.getTrack(peerId, mediaId);
      })
      .map(async (route) => {
        const transceiver = peer.addTransceiver(route.track.kind, "sendonly");
        route.subscribe(peerId, transceiver);
      });

    this.sendOffer(peer);
  };

  // --------------------------------------------------------------------
  // util
  private async sendOffer(peer: RTCPeerConnection) {
    await peer.setLocalDescription(peer.createOffer());

    this.sendRPC(
      {
        type: "handleOffer",
        payload: [peer.localDescription],
      },
      peer
    );
  }

  private sendRPC(msg: RPC, peer: RTCPeerConnection) {
    const channel = peer.sctpTransport.channelByLabel("sfu");
    if (!channel) return;
    channel.send(JSON.stringify(msg));
  }
}
