import { Event } from "../../../submodules/werift/packages/common/src/event.js";

export class DataSubscription {
  readonly subscriptionId: string;
  readonly publicationId: string;
  private channel: RTCDataChannel;

  // Events
  readonly onMessage = new Event<[string | ArrayBuffer]>();
  readonly onOpen = new Event<[]>();
  readonly onClose = new Event<[]>();
  readonly onError = new Event<[any]>();

  constructor(
    subscriptionId: string,
    publicationId: string,
    channel: RTCDataChannel,
  ) {
    this.subscriptionId = subscriptionId;
    this.publicationId = publicationId;
    this.channel = channel;
    this.setupChannelHandlers();
  }

  private setupChannelHandlers(): void {
    this.channel.onopen = () => {
      console.log(
        `Data subscription ${this.subscriptionId} for publication ${this.publicationId} opened`,
      );
      this.onOpen.execute();
    };

    this.channel.onclose = () => {
      console.log(
        `Data subscription ${this.subscriptionId} for publication ${this.publicationId} closed`,
      );
      this.onClose.execute();
    };

    this.channel.onerror = (error) => {
      console.error(
        `Data subscription ${this.subscriptionId} for publication ${this.publicationId} error:`,
        error,
      );
      this.onError.execute(error);
    };

    this.channel.onmessage = ({ data }) => {
      this.onMessage.execute(data as string | ArrayBuffer);
    };
  }

  close(): void {
    this.channel.close();
    this.onMessage.complete();
    this.onOpen.complete();
    this.onClose.complete();
    this.onError.complete();
  }

  get readyState(): RTCDataChannelState {
    return this.channel.readyState;
  }

  get label(): string {
    return this.channel.label;
  }
}
