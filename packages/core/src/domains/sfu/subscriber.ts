import debug from "debug";
import {
  ReceiverEstimatedMaxBitrate,
  RtcpPayloadSpecificFeedback,
} from "../../../../werift/rtp/src";
import {
  RTCPeerConnection,
  RTCRtpTransceiver,
} from "../../../../werift/webrtc/src";
import { Media } from "../media/media";

const log = debug("werift:sfu:subscriber");

export type SubscriberType = "high" | "low" | "single" | "auto";

export class Subscriber {
  private stopRTP: () => void = () => {};

  state: SubscriberType = "single";

  constructor(
    readonly peer: RTCPeerConnection,
    private media: Media,
    public sender?: RTCRtpTransceiver
  ) {}

  listenSingle() {
    this.state = "single";
    this.subscribe(this.state);
  }

  listenHigh() {
    this.state = "high";
    this.subscribe(this.state);
  }

  listenLow() {
    this.state = "low";
    this.subscribe(this.state);
  }

  listenAuto() {
    this.state = "auto";
    this.subscribe("high");
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
              this.stopRTP();
              this.subscribe(this.state);
              this.count = 0;
            }
            this.count++;
          } else {
            if (this.state !== "high" && this.count <= -this.threshold) {
              console.log("high");
              this.state = "high";
              this.stopRTP();
              this.subscribe(this.state);
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

  changeQuality(state: SubscriberType) {
    this.stopRTP();
    this.stopWatchREMB();

    this.state = state;

    if (state === "auto") {
      this.watchREMB();
      this.state = "high";
    }

    this.subscribe(this.state);
  }

  listenDataChannel() {
    const label = `__messaging:${this.media.mediaId}`;
    const sender = this.peer.sctpTransport.channelByLabel(label);
    if (!sender) {
      this.peer.createDataChannel(label);
    }
    this.media.onMessage.subscribe((msg) => {
      const sender = this.peer.sctpTransport.channelByLabel(label);
      if (sender) sender.send(msg);
    });
    return label;
  }

  private async subscribe(state: SubscriberType) {
    log("on subscribe", this.sender.uuid, state);

    const track =
      state === "single"
        ? this.media.tracks[0].track
        : this.media.tracks.find(({ track }) => track.rid.includes(state))
            .track;

    const [rtp] = await track.onRtp.asPromise();
    this.sender.replaceRtp(rtp.header);
    log("replace track", this.sender.uuid, rtp.header.ssrc);

    const { unSubscribe } = track.onRtp.subscribe((rtp) => {
      this.sender.sendRtp(rtp);
    });
    this.stopRTP = unSubscribe;
  }

  unsubscribe() {
    this.stopRTP();
    this.stopWatchREMB();
  }
}
