import debug from "debug";
import { v4 } from "uuid";
import {
  Kind,
  RTCRtpTransceiver,
  useAbsSendTime,
  useSdesMid,
  useSdesRTPStreamID,
} from "../../../werift/webrtc/src";
import { Connection } from "../responders/connection";
import { sleep } from "../utils/helper";
import { MCUManager } from "./mcu/manager";
import { Media, MediaInfo } from "./media/media";
import { PeerConnection } from "./peer";
import { SFUManager } from "./sfu/manager";
import { SFU } from "./sfu/sfu";

const log = debug("werift:sfu:room");

export class Room {
  readonly connection = new Connection(this);
  readonly sfuManager = new SFUManager();
  readonly mcuManager = new MCUManager();
  peers: { [peerId: string]: PeerConnection } = {};
  medias: { [mediaId: string]: Media } = {};

  async join() {
    const peerId = "p_" + v4();
    const peer = new PeerConnection({
      stunServer: ["stun.l.google.com", 19302],
      headerExtensions: {
        video: [useSdesMid(1), useAbsSendTime(2), useSdesRTPStreamID(3)],
        audio: [useSdesMid(1), useAbsSendTime(2)],
      },
    });
    this.peers[peerId] = peer;

    const channel = peer.createDataChannel("__sfu");
    this.connection.listen(channel, peer, peerId);

    await peer.setLocalDescription(peer.createOffer());
    return [peerId, peer.localDescription];
  }

  getUserMedias(peerId: string) {
    const medias = Object.values(this.medias).filter(
      (media) => media.publisherId === peerId
    );
    return medias;
  }

  async leave(peerId: string) {
    delete this.peers[peerId];

    const medias = this.getUserMedias(peerId);
    await Promise.all(
      medias.map((media) => {
        const sfu = this.getSFU(media);
        return sfu.stop();
      })
    );

    medias.forEach((media) => {
      delete this.medias[media.mediaId];
    });
  }

  createMedia(publisherId: string, { simulcast, kind }: CreateMediaRequest) {
    log("publish", publisherId, { simulcast, kind });
    const peer = this.peers[publisherId];

    const media = new Media(kind, publisherId);
    this.medias[media.mediaId] = media;

    if (kind === "application") {
      const label = `__messaging:${media.mediaId}`;
      const datachannel =
        peer.sctpTransport!.channelByLabel(label) ||
        peer.createDataChannel(label);
      media.initData(datachannel);
    } else {
      const simulcastId = peer.simulcastIndex++;
      const transceiver = simulcast
        ? peer.addTransceiver("video", "recvonly", {
            simulcast: [
              { rid: simulcastId + "high", direction: "recv" },
              { rid: simulcastId + "low", direction: "recv" },
            ],
          })
        : peer.addTransceiver(kind, "recvonly");
      media.initAV(transceiver, simulcast);
    }

    return { media, peer };
  }

  async publish(media: Media) {
    if (media.kind !== "application" && media.transceiver) {
      if (media.simulcast) {
        await media.transceiver.onTrack.asPromise();
        media.transceiver.receiver.tracks.forEach((track) =>
          media.addTrack(track)
        );
      } else {
        const [track] = await media.transceiver.onTrack.asPromise();
        media.addTrack(track);
      }
    } else {
      // todo fix
      // cause of datachannel send stuck
      await sleep(100);
    }

    const peers = Object.values(this.peers);

    return { peers, info: media.info };
  }

  async unPublish(info: MediaInfo) {
    const media = this.medias[info.mediaId];
    delete this.medias[info.mediaId];

    const peer = this.peers[info.publisherId];
    if (media.tracks.length > 0) {
      peer.removeTrack(media.tracks[0].receiver);
    }
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
    if (!media) {
      throw new Error();
    }
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

export type CreateMediaRequest = { kind: Kind; simulcast: boolean };
