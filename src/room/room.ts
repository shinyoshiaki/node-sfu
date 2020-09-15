/* eslint-disable @typescript-eslint/ban-ts-comment */
import { RTCPeerConnection, RTCSessionDescription, Kind } from "werift";

export class Room {
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
      switch (type) {
        case "requestPublish":
          //@ts-ignore
          this.requestPublish(...payload);
          break;
        case "publish":
          //@ts-ignore
          this.publish(...payload);
          break;
        case "getTransceivers":
          //@ts-ignore
          this.getTransceivers(...payload);
          break;
      }
    });
  }

  private async requestPublish(peerId: string, kinds: Kind[]) {
    const peer = this.peers[peerId];

    kinds.forEach((kind) => {
      peer.addTransceiver(kind, "recvonly");
    });

    const offer = peer.createOffer();
    await peer.setLocalDescription(offer);

    const msg = JSON.stringify({
      type: "returnRequestPublish",
      payload: { offer: peer.localDescription },
    });
    peer.sctpTransport.channelByLabel("sfu").send(msg);
    return offer;
  }

  private async publish(peerId: string, answer: RTCSessionDescription) {
    const peer = this.peers[peerId];
    await peer.setRemoteDescription(answer);
  }

  private getTransceivers(peerId: string) {
    const peer = this.peers[peerId];
  }
}
