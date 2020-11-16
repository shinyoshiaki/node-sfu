import { v4 } from "uuid";
import {
  Kind,
  RTCIceCandidateJSON,
  RTCPeerConnection,
  RTCRtpTransceiver,
  RTCSessionDescription,
  useSdesMid,
  useAbsSendTime,
  useSdesRTPStreamID,
} from "../../../../werift";
import { Connection } from "../responders/connection";
import { MediaInfo, Router } from "./router";
import { SubscriberType } from "./subscriber";

export class Room {
  router = new Router();
  connection = new Connection(this);
  peers: { [peerId: string]: RTCPeerConnection } = {};

  async join() {
    const peerId = "p_" + v4();
    const peer = new RTCPeerConnection({
      stunServer: ["stun.l.google.com", 19302],
      headerExtensions: {
        video: [useSdesMid(1), useAbsSendTime(2), useSdesRTPStreamID(3)],
        audio: [useSdesMid(1), useAbsSendTime(2), useSdesRTPStreamID(3)],
      },
    });
    this.peers[peerId] = peer;

    const channel = peer.createDataChannel("sfu");
    this.connection.listen(channel, peer, peerId);

    await peer.setLocalDescription(peer.createOffer());
    return [peerId, peer.localDescription];
  }

  async handleAnswer(peerId: string, answer: RTCSessionDescription) {
    const peer = this.peers[peerId];
    await peer.setRemoteDescription(answer);
    return peer;
  }

  async handleCandidate(peerId: string, candidate: RTCIceCandidateJSON) {
    const peer = this.peers[peerId];
    await peer.addIceCandidate(candidate);
  }

  async leave(peerId: string): Promise<[RTCPeerConnection[], MediaInfo[]]> {
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

    const peers = await Promise.all(
      Object.values(targets).map(async (peer) => {
        await peer.setLocalDescription(peer.createOffer());
        return peer;
      })
    );
    return [peers, infos];
  }

  async publish(
    publisherId: string,
    request: { kind: Kind; simulcast: boolean }[]
  ) {
    console.log("publish", publisherId, request);
    const peer = this.peers[publisherId];

    const transceivers = request.map(({ kind, simulcast }): [
      RTCRtpTransceiver,
      string,
      boolean
    ] => {
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
    });

    const responds = await Promise.all(
      transceivers.map(
        async ([receiver, kind, simulcast]): Promise<
          [RTCPeerConnection[], MediaInfo]
        > => {
          const mediaId = "m_" + v4();
          const mediaInfo = this.router.addMedia(publisherId, mediaId, kind);

          if (simulcast) {
            await receiver.onTrack.asPromise();
            receiver.receiver.tracks.forEach((track) =>
              this.router.addTrack(publisherId, track, receiver, mediaId)
            );
          } else {
            const [track] = await receiver.onTrack.asPromise();
            this.router.addTrack(publisherId, track, receiver, mediaId);
          }

          const peers = Object.values(this.peers).filter(
            (others) => others.cname !== peer.cname
          );

          return [peers, mediaInfo];
        }
      )
    );

    return responds;
  }

  async createOffer(peerID: string) {
    const peer = this.peers[peerID];
    await peer.setLocalDescription(peer.createOffer());
    return peer;
  }

  getMedias(peerId: string): [RTCPeerConnection, MediaInfo[]] {
    const peer = this.peers[peerId];
    const mediaInfos = this.router.mediaInfos;
    return [peer, mediaInfos];
  }

  async subscribe(
    subscriberId: string,
    requests: { info: MediaInfo; type: SubscriberType }[]
  ): Promise<
    [
      RTCPeerConnection,
      {
        mediaId: string;
        mid: string;
      }[]
    ]
  > {
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
    return [peer, meta];
  }

  changeQuality(subscriberId: string, info: MediaInfo, type: SubscriberType) {
    this.router.changeQuality(
      subscriberId,
      info.publisherId,
      info.mediaId,
      type
    );
  }
}
