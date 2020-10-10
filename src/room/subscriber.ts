import { sleep } from "../helper";
import {
  ReceiverEstimatedMaxBitrate,
  RtcpPayloadSpecificFeedback,
  RTCRtpTransceiver,
} from "../werift";
import { RtpHeader } from "../werift/vendor/rtp";
import { Track } from "./track";

export type SubscriberType = "high" | "low" | "fixed";

export class Subscriber {
  state: SubscriberType = "fixed";

  constructor(public sender: RTCRtpTransceiver, private tracks: Track[]) {}

  fixed() {
    this.state = "fixed";
    this.subscribe();
  }

  high() {
    this.state = "high";
    this.subscribe();
  }

  async low() {
    this.state = "low";
    this.subscribe();
  }

  count = 0;
  readonly threshold = 10;
  watchREMB() {
    this.sender.sender.onRtcp.subscribe((rtcp) => {
      if (rtcp.type === RtcpPayloadSpecificFeedback.type) {
        const psfb = rtcp as RtcpPayloadSpecificFeedback;
        if (psfb.feedback.count === ReceiverEstimatedMaxBitrate.count) {
          const remb = psfb.feedback as ReceiverEstimatedMaxBitrate;

          if (remb.bitrate / 1000n <= 200n) {
            if (this.state !== "low" && this.count >= this.threshold) {
              console.log("low");
              this.state = "low";
              this.count = 0;
            }
            this.count++;
          } else {
            if (this.state !== "high" && this.count <= -this.threshold) {
              console.log("high");
              this.state = "high";
              this.count = 0;
            }
            this.count--;
          }
          if (Math.abs(this.count) > this.threshold) this.count = 0;
        }
      }
    });
  }

  stop: (() => void)[] = [];

  changeQuality(state: SubscriberType) {
    this.stop.forEach((f) => f());
    this.state = state;
    this.subscribe();
  }

  private async subscribe() {
    this.stop = this.tracks.map(({ track }) => {
      const { unSubscribe } = track.onRtp.subscribe((rtp) => {
        if (this.state === track.rid) {
          this.sender.sendRtp(rtp);
        }
      });
      return unSubscribe;
    });
  }
}
