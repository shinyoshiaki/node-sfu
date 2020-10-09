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

  private async subscribe() {
    this.tracks.forEach((track) => {
      track.track.onRtp.subscribe((rtp) => {
        if (this.state == track.track.rid) {
          this.sender.sendRtp(rtp);
        }
      });
    });
  }
}
