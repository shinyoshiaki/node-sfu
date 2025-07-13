import { Event } from "../../../submodules/werift/packages/common/src/event.js";
import type { MediaStreamTrackLike } from "./type.js";

export class MediaSubscription {
  readonly subscriptionId: string;
  readonly publicationId: string;
  private _track: MediaStreamTrack | null = null;
  transceiver: RTCRtpTransceiver | null = null;

  // Events
  readonly onTrackReady = new Event<[MediaStreamTrackLike]>();
  readonly onError = new Event<[any]>();
  readonly onClose = new Event<[]>();

  constructor(subscriptionId: string, publicationId: string) {
    this.subscriptionId = subscriptionId;
    this.publicationId = publicationId;
  }

  get track(): MediaStreamTrackLike | null {
    return this._track as MediaStreamTrackLike | null;
  }

  setTrack(track: MediaStreamTrackLike, transceiver: RTCRtpTransceiver): void {
    this._track = track as MediaStreamTrack;
    this.transceiver = transceiver;

    // Set up track event handlers
    track.onended = () => {
      console.log(`Track ended for subscription ${this.subscriptionId}`);
      this.onClose.execute();
    };

    this.onTrackReady.execute(track);
  }

  close(): void {
    if (this._track) {
      if (this._track.readyState !== "ended") {
        this._track.stop();
      }
      this._track = null;
    }

    this.onTrackReady.complete();
    this.onError.complete();
    this.onClose.complete();
  }
}
