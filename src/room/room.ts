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

  handleAnswer(peerId: string, answer: RTCSessionDescription) {
    const peer = this.peers[peerId];
    peer.setRemoteDescription(answer);
  }

  handleCandidate(peerId: string, candidate: RTCIceCandidateJSON) {
    const peer = this.peers[peerId];
    peer.addIceCandidate(candidate);
  }

  private requestPublish = (peerId: string, kinds: Kind[]) => {
    console.log("requestPublish", kinds);
    const peer = this.peers[peerId];

    kinds
      .map((kind) => peer.addTransceiver(kind, "recvonly"))
      .forEach((transceiver) => {
        transceiver.onTrack.subscribe((track) => {
          this.router.addTrack(peerId, track, transceiver);
        });
      });

    this.sendOffer(peer);
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
      .map((id) => this.router.getTrack(peerId, id))
      .map(async (track) => {
        const transceiver = peer.addTransceiver(track.kind, "sendonly");
        await transceiver.sender.onReady.asPromise();
        track.onRtp.subscribe((rtp) => {
          transceiver.sendRtp(rtp);
        });
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
    peer.sctpTransport.channelByLabel("sfu").send(JSON.stringify(msg));
  }
}
