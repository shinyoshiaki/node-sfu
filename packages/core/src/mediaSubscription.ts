import { Event } from "../../../submodules/werift/packages/common/src/event.js";
import type { RTCRtpTransceiver } from "../../../submodules/werift/packages/webrtc/src/index.js";

export class MediaSubscription {
  readonly subscriptionId: string;
  readonly publicationId: string;
  readonly subscriberMemberId: string;
  private _transceiver: RTCRtpTransceiver | null = null;

  // Events
  readonly onClose = new Event<[]>();
  readonly onError = new Event<[any]>();

  constructor(
    subscriptionId: string,
    publicationId: string,
    subscriberMemberId: string,
  ) {
    this.subscriptionId = subscriptionId;
    this.publicationId = publicationId;
    this.subscriberMemberId = subscriberMemberId;
  }

  get transceiver(): RTCRtpTransceiver | null {
    return this._transceiver;
  }

  setTransceiver(transceiver: RTCRtpTransceiver): void {
    this._transceiver = transceiver;
    console.log(
      `Set transceiver for media subscription ${this.subscriptionId} (publication ${this.publicationId})`,
    );
  }

  close(): void {
    if (this._transceiver) {
      // Stop the transceiver
      this._transceiver.stop();
      this._transceiver = null;
    }

    this.onClose.execute();
    this.onClose.complete();
    this.onError.complete();
  }

  dispose(): void {
    this.close();
  }
}
