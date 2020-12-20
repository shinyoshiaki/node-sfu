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
import { MCUManager } from "./mcu/manager";
import { Media, MediaInfo } from "./media/media";
import { SFUManager } from "./sfu/manager";
import { SFU } from "./sfu/sfu";

const log = debug("werift:sfu:room");

export class Room {
  readonly connection = new Connection(this);
  readonly sfuManager = new SFUManager();
  readonly mcuManager = new MCUManager();
  peers: { [peerId: string]: RTCPeerConnection } = {};
  medias: { [mediaId: string]: Media } = {};

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

  leave(peerId: string) {
    delete this.peers[peerId];

    const infos = Object.values(this.medias)
      .filter((media) => media.publisherId === peerId)
      .map((media) => {
        media.stop();
        return media.info;
      });

    infos.forEach((info) => {
      delete this.medias[info.mediaId];
    });

    return infos;
  }

  createMedia(
    publisherId: string,
    { simulcast, kind }: { kind: Kind; simulcast: boolean }
  ) {
    log("publish", publisherId, { simulcast, kind });
    const peer = this.peers[publisherId];

    const transceiver = simulcast
      ? peer.addTransceiver("video", "recvonly", {
          simulcast: [
            { rid: "high", direction: "recv" },
            { rid: "low", direction: "recv" },
          ],
        })
      : peer.addTransceiver(kind, "recvonly");
    const media = new Media(publisherId, transceiver, simulcast);
    this.medias[media.mediaId] = media;

    return { media, peer };
  }

  async publish(media: Media, peer: RTCPeerConnection) {
    if (media.simulcast) {
      await media.transceiver.onTrack.asPromise();
      media.transceiver.receiver.tracks.forEach((track) =>
        media.addTrack(track)
      );
    } else {
      const [track] = await media.transceiver.onTrack.asPromise();
      media.addTrack(track);
    }

    const peers = Object.values(this.peers);

    return { peers, info: media.info };
  }

  async unPublish(info: MediaInfo) {
    const media = this.medias[info.mediaId];
    delete this.medias[info.mediaId];

    const peer = this.peers[info.publisherId];
    peer.removeTrack(media.tracks[0].receiver);
    await peer.setLocalDescription(peer.createOffer());

    return peer;
  }

  getMedias(peerId: string) {
    const peer = this.peers[peerId];
    const infos = Object.values(this.medias).map((media) => media.info);
    return { peer, infos };
  }

  getSFU(info: MediaInfo): SFU {
    if (this.sfuManager.getSFU(info.mediaId))
      return this.sfuManager.getSFU(info.mediaId);

    const media = this.medias[info.mediaId];
    return this.sfuManager.createSFU(media);
  }

  createMCU(infos: MediaInfo[], subscriber: RTCRtpTransceiver) {
    const medias = infos.map((info) => this.medias[info.mediaId]);
    return this.mcuManager.createMCU(medias, subscriber);
  }

  getMCU(mcuId: string) {
    return this.mcuManager.getMCU(mcuId);
  }
}
