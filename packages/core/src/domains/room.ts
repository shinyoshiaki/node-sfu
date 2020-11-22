import debug from "debug";
import { v4 } from "uuid";
import {
  Kind,
  RTCPeerConnection,
  RTCRtpTransceiver,
  useAbsSendTime,
  useSdesMid,
  useSdesRTPStreamID,
} from "../../../werift";
import { Connection } from "../responders/connection";
import { MediaInfo, Router } from "./router";
import { SubscriberType } from "./sfu/subscriber";

const log = debug("werift:sfu:room");

export class Room {
  readonly router = new Router();
  readonly connection = new Connection(this);
  peers: { [peerId: string]: RTCPeerConnection } = {};

  async join() {
    const peerId = "p_" + v4();
    const peer = new RTCPeerConnection({
      stunServer: ["stun.l.google.com", 19302],
      headerExtensions: {
        video: [useSdesMid(1), useAbsSendTime(2), useSdesRTPStreamID(3)],
        audio: [useSdesMid(1), useAbsSendTime(2)],
      },
    });
    this.peers[peerId] = peer;

    const channel = peer.createDataChannel("sfu");
    this.connection.listen(channel, peer, peerId);

    await peer.setLocalDescription(peer.createOffer());
    return [peerId, peer.localDescription];
  }

  async leave(peerId: string): Promise<[RTCPeerConnection[], MediaInfo[]]> {
    const { subscribers, infos } = this.router.leave(peerId);

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
    log("publish", publisherId, request);
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
      transceivers.map(async ([receiver, kind, simulcast]) => {
        const info = this.router.createMedia(publisherId, kind);

        if (simulcast) {
          await receiver.onTrack.asPromise();
          receiver.receiver.tracks.forEach((track) =>
            this.router.addTrack(track, receiver, info.mediaId)
          );
        } else {
          const [track] = await receiver.onTrack.asPromise();
          this.router.addTrack(track, receiver, info.mediaId);
        }

        const peers = Object.values(this.peers).filter(
          (others) => others.cname !== peer.cname
        );

        return { peers, info };
      })
    );

    return responds;
  }

  getMedias(peerId: string): [RTCPeerConnection, MediaInfo[]] {
    const peer = this.peers[peerId];
    const mediaInfos = this.router.mediaInfos;
    return [peer, mediaInfos];
  }

  async subscribe(
    subscriberId: string,
    requests: { info: MediaInfo; type: SubscriberType }[]
  ) {
    const peer = this.peers[subscriberId];

    const pairs = requests.map(({ info, type }) => {
      const { mediaId, kind } = info;
      const transceiver = peer.addTransceiver(kind as Kind, "sendonly");
      this.router.subscribe(subscriberId, mediaId, transceiver, type);
      return { mediaId, uuid: transceiver.uuid };
    });
    await peer.setLocalDescription(peer.createOffer());
    const meta = pairs.map(({ mediaId, uuid }) => {
      const transceiver = peer.transceivers.find((t) => t.uuid === uuid);
      return { mediaId, mid: transceiver.mid };
    });
    return { peer, meta };
  }

  async listenMixedAudio(subscriberId: string, infos: MediaInfo[]) {
    const peer = this.peers[subscriberId];
    const transceiver = peer.addTransceiver("audio", "sendonly");
    await peer.setLocalDescription(peer.createOffer());

    infos = infos.filter((info) => info.publisherId !== subscriberId);

    const mixId = this.router.listenMixedAudio(
      infos.map((v) => v.mediaId),
      transceiver
    );
    const meta = { mid: transceiver.mid, mixId };

    return { peer, meta };
  }

  addMixedAudioTrack(mixerId: string, info: MediaInfo) {
    this.router.addMixedAudioTrack(mixerId, info.mediaId);
  }

  removeMixedAudioTrack(mixerId: string, info: MediaInfo) {
    this.router.removeMixedAudioTrack(mixerId, info.mediaId);
  }

  changeQuality(subscriberId: string, info: MediaInfo, type: SubscriberType) {
    this.router.changeQuality(subscriberId, info.mediaId, type);
  }
}
