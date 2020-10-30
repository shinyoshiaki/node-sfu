import {
  ReceiverEstimatedMaxBitrate,
  RtcpPayloadSpecificFeedback,
  RTCRtpTransceiver,
} from "../werift";
import { Track } from "./track";
import debug from "debug";
import { sleep } from "../helper";

const log = debug("werift:sfu:subscriber");

export type SubscriberType = "high" | "low" | "single" | "auto";

export class Subscriber {
  state: SubscriberType = "single";

  constructor(public sender: RTCRtpTransceiver, private tracks: Track[]) {}

  single() {
    this.state = "single";
    this.subscribe();
  }

  high() {
    this.state = "high";
    this.subscribe();
  }

  low() {
    this.state = "low";
    this.subscribe();
  }

  auto() {
    this.state = "auto";
    this.subscribe();
    this.watchREMB();
  }

  count = 0;
  readonly threshold = 10;
  stopWatchREMB: () => void = () => {};
  private watchREMB() {
    const { unSubscribe } = this.sender.sender.onRtcp.subscribe((rtcp) => {
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
    this.stopWatchREMB = unSubscribe;
  }

  private stopRTP: () => void = () => {};

  changeQuality(state: SubscriberType) {
    this.stopRTP();
    this.stopWatchREMB();

    this.state = state;

    if (state === "auto") {
      this.watchREMB();
      this.state = "high";
    }

    this.subscribe();
  }

  private async subscribe() {
    log("on subscribe", this.sender.uuid, this.state);

    const { track } = this.tracks.find(({ track }) => track.rid === this.state);

    const rtp = await track.onRtp.asPromise();
    this.sender.replaceRtp(rtp.header);
    log("replace track", this.sender.uuid, rtp.header.ssrc);

    const { unSubscribe } = track.onRtp.subscribe((rtp) => {
      this.sender.sendRtp(rtp);
    });
    this.stopRTP = unSubscribe;
  }
}
