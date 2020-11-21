import { OpusEncoder } from "@discordjs/opus";
import { Mixer } from "@shinyoshiaki/audio-mixer";
import { performance } from "perf_hooks";
import { v4 } from "uuid";
import { RTCRtpTransceiver, RtpTrack } from "../../../../werift";
import {
  random16,
  random32,
  uint16Add,
  uint32Add,
} from "../../../../werift/utils";
import { RtpHeader, RtpPacket } from "../../../../werift/vendor/rtp";
import { Media } from "../media/media";

const MAX_FRAME_SIZE = (48000 * 60) / 1000;
const PCM_LENGTH = MAX_FRAME_SIZE * 2 * 2;

export class MCUMixer {
  id = "mix_" + v4();

  private encoder = new OpusEncoder(48000, 2);
  private mixer = new Mixer({ sampleRate: 48000, channels: 2, sleep: 20 });
  private sequenceNumber = random16();
  private timestamp = random32();
  private now = performance.now();
  private disposer = [];

  constructor(medias: Media[], private sender: RTCRtpTransceiver) {
    medias.forEach((media) => this.inputMedia(media.tracks[0].track));
    this.listen();
  }

  inputMedia(track: RtpTrack) {
    const input = this.mixer.input({ channels: 2, maxBuffer: PCM_LENGTH / 2 });
    const { unSubscribe } = track.onRtp.subscribe((packet) => {
      const decoded = this.encoder.decode(packet.payload);
      input.write(decoded);
    });
    this.disposer.push(unSubscribe);
  }

  listen() {
    this.mixer.on("data", (data) => {
      const encoded = this.encoder.encode(data);

      this.sequenceNumber = uint16Add(this.sequenceNumber, 1);

      const now = performance.now();
      const delta = now - this.now;
      this.now = now;
      const frame = Math.floor(delta / 20);
      this.timestamp = uint32Add(this.timestamp, 960n * BigInt(frame));

      const header = new RtpHeader({
        sequenceNumber: this.sequenceNumber,
        timestamp: Number(this.timestamp),
        payloadType: 96,
        payloadOffset: 12,
        extension: true,
        marker: false,
        padding: false,
      });
      const rtp = new RtpPacket(header, encoded);
      this.sender.sendRtp(rtp);
    });
  }

  close() {
    this.disposer.forEach((v) => v());
  }
}
