import {
  EventDisposer,
  type MediaStreamTrack,
  type RTCRtpTransceiver,
} from "../../../submodules/werift/packages/webrtc/src/index.js";

export class MediaPublication {
  public track: MediaStreamTrack | null = null;
  public transceiver: RTCRtpTransceiver | null = null;
  private readonly disposer = new EventDisposer();

  constructor(
    public readonly publicationId: string,
    public readonly memberId: string,
  ) {}

  setTrack(track: MediaStreamTrack, transceiver: RTCRtpTransceiver): void {
    this.track = track;
    this.transceiver = transceiver;

    const interval = setInterval(() => {
      transceiver.receiver.sendRtcpPLI(track.ssrc!);
    }, 1000);
    this.disposer.push(() => clearInterval(interval));
  }

  dispose(): void {
    this.disposer.dispose();
  }
}
