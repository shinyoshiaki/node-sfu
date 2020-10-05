import {
  ReceiverEstimatedMaxBitrate,
  RtcpPayloadSpecificFeedback,
  RTCRtpTransceiver,
} from "../werift";
import { Track } from "./track";

export type SubscriberType = "high" | "low" | "fixed";

export class Subscriber {
  state: SubscriberType = "fixed";

  stop: () => void;
  constructor(public sender: RTCRtpTransceiver, private tracks: Track[]) {}

  fixed() {
    this.state = "fixed";
    const track = this.tracks.find(({ track }) => track.ssrc);
    this.subscribe(track);
  }

  high() {
    this.state = "high";
    const track = this.tracks.find(({ track }) => track.rid === "high");
    this.subscribe(track);
  }

  low() {
    this.state = "low";
    const track = this.tracks.find(({ track }) => track.rid === "low");
    this.subscribe(track);
  }

  count = 0;
  readonly threshold = 5;
  watchREMB() {
    this.sender.sender.onRtcp.subscribe((rtcp) => {
      if (rtcp.type === RtcpPayloadSpecificFeedback.type) {
        const psfb = rtcp as RtcpPayloadSpecificFeedback;
        if (psfb.feedback.count === ReceiverEstimatedMaxBitrate.count) {
          const remb = psfb.feedback as ReceiverEstimatedMaxBitrate;

          if (remb.bitrate <= 180_000n) {
            if (this.state !== "low" && this.count > this.threshold) {
              console.log("low");
              this.stop();
              this.low();
              this.count = 0;
            }
            this.count++;
          } else {
            if (this.state !== "high" && this.count < -this.threshold) {
              console.log("high");
              this.stop();
              this.high();
            }
            this.count--;
          }
          if (Math.abs(this.count) > this.threshold) this.count = 0;
        }
      }
    });
  }

  private async subscribe(track: Track) {
    const rtp = await track.track.onRtp.asPromise();

    const { unSubscribe } = track.track.onRtp.subscribe((rtp) => {
      try {
        this.sender.sendRtp(rtp);
      } catch (error) {
        console.log("ice error", error);
      }
    });
    this.stop = unSubscribe;

    track.receiver.receiver.sendRtcpPLI(rtp.header.ssrc);
  }
}
