import { Event } from "../../../submodules/werift/packages/common/src/event.js";
import type { RTCDataChannel } from "../../../submodules/werift/packages/webrtc/src/index.js";

export class DataSubscription {
  readonly subscriptionId: string;
  readonly publicationId: string;
  readonly subscriberMemberId: string;
  private channel: RTCDataChannel;

  // Events
  readonly onMessage = new Event<[string | ArrayBuffer]>();
  readonly onOpen = new Event<[]>();
  readonly onClose = new Event<[]>();
  readonly onError = new Event<[any]>();

  constructor(
    subscriptionId: string,
    publicationId: string,
    subscriberMemberId: string,
    channel: RTCDataChannel,
  ) {
    this.subscriptionId = subscriptionId;
    this.publicationId = publicationId;
    this.subscriberMemberId = subscriberMemberId;
    this.channel = channel;
    this.setupChannelHandlers();
  }

  private setupChannelHandlers(): void {
    this.channel.onOpen.subscribe(() => {
      console.log(
        `Data subscription ${this.subscriptionId} for publication ${this.publicationId} opened`,
      );
      this.onOpen.execute();
    });

    this.channel.onClose.subscribe(() => {
      console.log(
        `Data subscription ${this.subscriptionId} for publication ${this.publicationId} closed`,
      );
      this.onClose.execute();
    });

    this.channel.onError.subscribe((error) => {
      console.error(
        `Data subscription ${this.subscriptionId} for publication ${this.publicationId} error:`,
        error,
      );
      this.onError.execute(error);
    });

    this.channel.onMessage.subscribe((data) => {
      this.onMessage.execute(data as string | ArrayBuffer);
    });
  }

  forwardMessage(data: string | ArrayBuffer): void {
    if (this.channel.readyState === "open") {
      this.channel.send(data as any);
    } else {
      console.warn(
        `Cannot forward message to subscription ${this.subscriptionId}: channel is ${this.channel.readyState}`,
      );
    }
  }

  close(): void {
    this.channel.close();
    this.onMessage.complete();
    this.onOpen.complete();
    this.onClose.complete();
    this.onError.complete();
  }

  dispose(): void {
    this.close();
  }

  get readyState(): string {
    return this.channel.readyState;
  }

  get label(): string {
    return this.channel.label;
  }
}
