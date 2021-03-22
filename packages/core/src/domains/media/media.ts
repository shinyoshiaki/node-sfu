import { v4 } from "uuid";
import {
  Kind,
  RTCDataChannel,
  RTCRtpTransceiver,
  MediaStreamTrack,
} from "../../../../werift/webrtc/src";
import { ReceiverTrack } from "./track";
import { Event } from "rx.mini";

export class Media {
  readonly mediaId = "m_" + v4();
  readonly onMessage = new Event<[Buffer | string]>();
  tracks: ReceiverTrack[] = [];
  transceiver?: RTCRtpTransceiver;
  simulcast!: boolean;
  datachannel?: RTCDataChannel;

  constructor(readonly kind: Kind, readonly publisherId: string) {}

  initAV(transceiver: RTCRtpTransceiver, simulcast: boolean) {
    this.transceiver = transceiver;
    this.simulcast = simulcast;
    return this;
  }

  initData(datachannel: RTCDataChannel) {
    this.datachannel = datachannel;
    datachannel.message.subscribe((msg) => {
      this.onMessage.execute(msg);
    });
    return this;
  }

  addTrack(msTrack: MediaStreamTrack) {
    if (this.kind !== msTrack.kind) throw new Error();

    const track = new ReceiverTrack(msTrack, this.transceiver!);
    this.tracks.push(track);
  }

  stop() {
    this.tracks.forEach((track) => track.stop());
  }

  get info(): MediaInfo {
    return {
      mediaId: this.mediaId,
      kind: this.kind,
      publisherId: this.publisherId,
      simulcast: this.simulcast,
    };
  }
}

export type MediaInfo = {
  mediaId: string;
  kind: MediaInfoKind;
  publisherId: string;
  simulcast: boolean;
};

export type MediaInfoKind = Kind | "mixer";
