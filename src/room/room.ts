/* eslint-disable @typescript-eslint/ban-ts-comment */
import { RTCPeerConnection, RTCSessionDescription, Kind } from "werift";
import { Router } from "./router";

export class Room {
  router = new Router();
  peers: { [peerId: string]: RTCPeerConnection } = {};

  async requestJoin(peerId: string) {
    const peer = (this.peers[peerId] = new RTCPeerConnection());
    peer.createDataChannel("sfu");
    await peer.setLocalDescription(peer.createOffer());
    return peer.localDescription;
  }

  async join(peerId: string, answer: RTCSessionDescription) {
    const peer = this.peers[peerId];
    await peer.setRemoteDescription(answer);
    peer.sctpTransport.channelByLabel("sfu").message.subscribe((msg) => {
      const { type, payload } = JSON.parse(msg as string);
      //@ts-ignore
      this[type](...payload);
    });
  }

  private async requestPublish(peerId: string, kinds: Kind[]) {
    const peer = this.peers[peerId];

    kinds
      .map((kind) => peer.addTransceiver(kind, "recvonly"))
      .forEach((t) => {
        t.onTrack.subscribe((track) => {
          this.router.addTrack(peerId, track);
        });
      });

    const offer = peer.createOffer();
    await peer.setLocalDescription(offer);

    const msg = JSON.stringify({
      type: "requestPublish",
      payload: { offer: peer.localDescription },
    });
    peer.sctpTransport.channelByLabel("sfu").send(msg);
    return offer;
  }

  private async publish(peerId: string, answer: RTCSessionDescription) {
    const peer = this.peers[peerId];
    await peer.setRemoteDescription(answer);
  }

  private getTracks(peerId: string) {
    const peer = this.peers[peerId];
    const msg = JSON.stringify({
      type: "getTracks",
      payload: { infos: this.router.trackInfos },
    });
    peer.sctpTransport.channelByLabel("sfu").send(msg);
  }
}
