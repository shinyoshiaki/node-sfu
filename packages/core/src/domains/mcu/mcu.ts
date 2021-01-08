import { OpusEncoder } from "@discordjs/opus";
import { v4 } from "uuid";
import { RTCRtpTransceiver } from "../../../../werift/webrtc/src";
import { random16, uint16Add } from "../../../../werift/webrtc/src/utils";
import { RtpHeader, RtpPacket } from "../../../../werift/rtp/src";
import { Media } from "../media/media";
import { Input, Mixer } from "./mixer";

export class MCU {
  readonly id = "mcu_" + v4();

  private readonly encoder = new OpusEncoder(48000, 2);
  private readonly mixer = new Mixer({ bit: 16 });
  private sequenceNumber = random16();
  private disposer: {
    [mediaId: string]: { stop: () => void; input: Input; id: string };
  } = {};
  private header!: RtpHeader;

  constructor(medias: Media[], private sender: RTCRtpTransceiver) {
    medias.forEach((media) => this.inputMedia(media));
    this.listen();
  }

  inputMedia(media: Media) {
    const input = this.mixer.input();
    const { unSubscribe } = media.tracks[0].track.onRtp.subscribe((packet) => {
      const disposer = Object.values(this.disposer)[0];
      if (!disposer) return;
      if (disposer.id === media.mediaId) {
        this.header = packet.header;
      }
      const decoded = this.encoder.decode(packet.payload);
      input.write(decoded);
    });
    this.disposer[media.mediaId] = {
      stop: unSubscribe,
      input,
      id: media.mediaId,
    };
  }

  removeMedia = (mediaId: string) => {
    const { stop, input } = this.disposer[mediaId];
    input.remove();
    delete this.disposer[mediaId];
    stop();
  };

  private listen() {
    this.mixer.onData = (data) => {
      if (!this.header) return;
      const encoded = this.encoder.encode(data);

      this.sequenceNumber = uint16Add(this.sequenceNumber, 1);

      const header = new RtpHeader({
        sequenceNumber: this.sequenceNumber,
        timestamp: this.header.timestamp,
        payloadType: 96,
        payloadOffset: 12,
        extension: true,
        marker: false,
        padding: false,
      });
      const rtp = new RtpPacket(header, encoded);
      this.sender.sendRtp(rtp);
    };
  }

  close() {
    Object.keys(this.disposer).forEach(this.removeMedia);
  }
}
