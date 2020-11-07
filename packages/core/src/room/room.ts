/* eslint-disable @typescript-eslint/ban-ts-comment */
import { v4 } from "uuid";
import {
  HandleAnswerDone,
  HandleLeave,
  HandleMedias,
  HandleOffer,
  HandlePublish,
  RPC,
} from "../typings/rpc";
import {
  Kind,
  RTCIceCandidateJSON,
  RTCPeerConnection,
  RTCRtpTransceiver,
  RTCSessionDescription,
  useSdesRTPStreamID,
} from "../werift";
import {
  useAbsSendTime,
  useSdesMid,
} from "../werift/rtc/extension/rtpExtension";
import { MediaInfo, Router } from "./router";
import { SubscriberType } from "./subscriber";

export class Room {
  router = new Router();
  peers: { [peerId: string]: RTCPeerConnection } = {};

  constructor() {
    console.log("room start");
  }

  async join(): Promise<[string, RTCSessionDescription]> {
    const peerId = "p_" + v4();
    const peer = (this.peers[peerId] = new RTCPeerConnection({
      stunServer: ["stun.l.google.com", 19302],
      headerExtensions: {
        video: [useSdesMid(1), useAbsSendTime(2), useSdesRTPStreamID(3)],
      },
    }));

    peer.createDataChannel("sfu").message.subscribe((msg) => {
      const { type, payload } = JSON.parse(msg as string) as RPC;
      //@ts-ignore
      this[type](...payload);
    });

    peer.iceConnectionStateChange.subscribe((state) => {
      console.log(peerId, state);
      if (state === "disconnected") {
        this.leave(peerId);
        peer.close();
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
    this.sendRPC<HandleAnswerDone>(
      { type: "handleAnswerDone", payload: [] },
      peer
    );
  }

  async handleCandidate(peerId: string, candidate: RTCIceCandidateJSON) {
    console.log("handleCandidate", peerId);
    const peer = this.peers[peerId];
    await peer.addIceCandidate(candidate);
  }

  publish = async (
    publisherId: string,
    request: { kind: Kind; simulcast: boolean }[]
  ) => {
    console.log("publish", publisherId, request);
    const peer = this.peers[publisherId];

    request
      .map(({ kind, simulcast }): [RTCRtpTransceiver, string, boolean] => {
        if (!simulcast) {
          return [peer.addTransceiver(kind, "recvonly"), kind, simulcast];
        } else {
          return [
            peer.addTransceiver("video", "recvonly", {
              simulcast: [
                { rid: "high", direction: "recv" },
                { rid: "low", direction: "recv" },
              ],
            }),
            kind,
            simulcast,
          ];
        }
      })
      .forEach(async ([receiver, kind, simulcast]) => {
        const mediaId = "m_" + v4();
        const mediaInfo = this.router.addMedia(publisherId, mediaId, kind);

        if (simulcast) {
          await receiver.onTrack.asPromise();
          receiver.receiver.tracks.forEach((track) =>
            this.router.addTrack(publisherId, track, receiver, mediaId)
          );
        } else {
          const track = await receiver.onTrack.asPromise();
          this.router.addTrack(publisherId, track, receiver, mediaId);
        }

        Object.values(this.peers)
          .filter((others) => others.cname !== peer.cname)
          .forEach((peer) => {
            this.sendRPC<HandlePublish>(
              {
                type: "handlePublish",
                payload: [mediaInfo],
              },
              peer
            );
          });
      });

    await peer.setLocalDescription(peer.createOffer());

    this.sendRPC<HandleOffer>(
      {
        type: "handleOffer",
        payload: [peer.localDescription],
      },
      peer
    );
  };

  getMedias = (peerId: string) => {
    console.log("getMedias", peerId);
    const peer = this.peers[peerId];
    this.sendRPC<HandleMedias>(
      {
        type: "handleMedias",
        payload: [this.router.mediaInfos],
      },
      peer
    );
  };

  subscribe = async (
    subscriberId: string,
    requests: { info: MediaInfo; type: SubscriberType }[]
  ) => {
    const peer = this.peers[subscriberId];

    const pairs = requests.map(({ info, type }) => {
      const { publisherId, mediaId, kind } = info;
      const transceiver = peer.addTransceiver(kind as Kind, "sendonly");
      this.router.subscribe(
        subscriberId,
        publisherId,
        mediaId,
        transceiver,
        type
      );
      return { mediaId, uuid: transceiver.uuid };
    });
    await peer.setLocalDescription(peer.createOffer());
    const meta = pairs.map(({ mediaId, uuid }) => {
      const transceiver = peer.transceivers.find((t) => t.uuid === uuid)!;
      return { mediaId, mid: transceiver.mid };
    });

    this.sendRPC<HandleOffer>(
      {
        type: "handleOffer",
        payload: [peer.localDescription, meta],
      },
      peer
    );
  };

  changeQuality = (
    subscriberId: string,
    info: MediaInfo,
    type: SubscriberType
  ) => {
    this.router.changeQuality(
      subscriberId,
      info.publisherId,
      info.mediaId,
      type
    );
  };

  leave = async (peerId: string) => {
    this.router.getSubscribed(peerId).forEach((media) => {
      this.router.unsubscribe(peerId, media.publisherId, media.mediaId);
    });

    const infos = this.router.mediaInfos.filter(
      (info) => info.publisherId === peerId
    );
    const subscribers = infos.map((info) =>
      this.router.removeMedia(peerId, info.mediaId)
    );

    const targets: { [subscriberId: string]: RTCPeerConnection } = {};

    subscribers.forEach((subscriber) => {
      Object.entries(subscriber).forEach(([subscriberId, pair]) => {
        const peer = this.peers[subscriberId];
        if (!peer) return;
        peer.removeTrack(pair.sender.sender);
        targets[subscriberId] = peer;
      });
    });

    delete this.peers[peerId];

    await Promise.all(
      Object.values(targets).map(async (peer) => {
        await peer.setLocalDescription(peer.createOffer());
        this.sendRPC<HandleLeave>(
          { type: "handleLeave", payload: [infos, peer.localDescription] },
          peer
        );
      })
    );
  };

  // --------------------------------------------------------------------
  // util

  private sendRPC<T extends RPC>(msg: T, peer: RTCPeerConnection) {
    const channel = peer.sctpTransport.channelByLabel("sfu");
    if (!channel) return;
    channel.send(JSON.stringify(msg));
  }
}
