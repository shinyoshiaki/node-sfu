/* eslint-disable @typescript-eslint/ban-ts-comment */
import { v4 } from "uuid";
import {
  RTCPeerConnection,
  RTCSessionDescription,
  Kind,
  RTCIceCandidateJSON,
  useSdesRTPStreamID,
} from "../werift";
import { Router, TrackInfo } from "./router";

type RPC = { type: string; payload: any[] };

export class Room {
  router = new Router();
  peers: { [peerId: string]: RTCPeerConnection } = {};

  async join(): Promise<[string, RTCSessionDescription]> {
    const peerId = v4();
    const peer = (this.peers[peerId] = new RTCPeerConnection({
      stunServer: ["stun.l.google.com", 19302],
      headerExtensions: { video: [useSdesRTPStreamID()] },
    }));

    peer.createDataChannel("sfu").message.subscribe((msg) => {
      const { type, payload } = JSON.parse(msg as string) as RPC;
      //@ts-ignore
      this[type](...payload);
    });

    peer.iceConnectionStateChange.subscribe((state) => {
      console.log(peerId, state);
      if (state === "closed") {
        this.leave(peerId);
      }
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
    this.sendRPC({ type: "handleAnswerDone", payload: [] }, peer);
  }

  async handleCandidate(peerId: string, candidate: RTCIceCandidateJSON) {
    console.log("handleCandidate", peerId);
    const peer = this.peers[peerId];
    await peer.addIceCandidate(candidate);
  }

  private publish = async (
    publisherId: string,
    kinds: Kind[],
    simulcast: boolean
  ) => {
    console.log("publish", publisherId, kinds);
    const peer = this.peers[publisherId];

    kinds
      .map((kind) => {
        if (!simulcast) {
          return peer.addTransceiver(kind, "recvonly");
        } else {
          return peer.addTransceiver("video", "recvonly", {
            simulcast: [
              { rid: "high", direction: "recv" },
              { rid: "low", direction: "recv" },
            ],
          });
        }
      })
      .forEach((transceiver) => {
        transceiver.onTrack.subscribe((track) => {
          const trackInfo = this.router.addTrack(
            publisherId,
            track,
            transceiver
          );

          Object.values(this.peers)
            .filter((others) => others.cname !== peer.cname)
            .forEach((peer) => {
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
    console.log("getTracks", peerId);
    const peer = this.peers[peerId];
    this.sendRPC(
      {
        type: "handleTracks",
        payload: [this.router.trackInfos],
      },
      peer
    );
  };

  private subscribe = async (subscriberId: string, infos: TrackInfo[]) => {
    const peer = this.peers[subscriberId];
    infos.map((info) => {
      const { publisherId, trackId, kind } = info;
      const transceiver = peer.addTransceiver(kind as Kind, "sendonly");
      this.router.subscribe(subscriberId, publisherId, trackId, transceiver);
    });

    await this.sendOffer(peer);
  };

  private leave = async (peerId: string) => {
    this.router.getSubscribed(peerId).forEach((track) => {
      this.router.unsubscribe(peerId, track.publisherId, track.trackId);
    });

    const infos = this.router.trackInfos.filter(
      (info) => info.publisherId === peerId
    );
    const subscribers = infos.map((info) =>
      this.router.removeTrack(peerId, info.trackId)
    );

    const targets: { [subscriberId: string]: RTCPeerConnection } = {};

    subscribers.forEach((subscriber) => {
      Object.entries(subscriber).forEach(([subscriberId, pair]) => {
        const peer = this.peers[subscriberId];
        if (!peer) return;
        peer.removeTrack(pair.transceiver.sender);
        targets[subscriberId] = peer;
      });
    });

    delete this.peers[peerId];

    await Promise.all(
      Object.values(targets).map(async (peer) => {
        await peer.setLocalDescription(peer.createOffer());
        this.sendRPC(
          { type: "handleLeave", payload: [infos, peer.localDescription] },
          peer
        );
      })
    );
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
