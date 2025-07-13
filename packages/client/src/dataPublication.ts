import { Event } from "../../../submodules/werift/packages/common/src/event.js";

export class DataPublication {
  readonly publicationId: string;
  private channel: RTCDataChannel;

  // Events
  readonly onOpen = new Event<[]>();
  readonly onClose = new Event<[]>();
  readonly onError = new Event<[any]>();

  constructor(publicationId: string, channel: RTCDataChannel) {
    this.publicationId = publicationId;
    this.channel = channel;
    this.setupChannelHandlers();
  }

  private setupChannelHandlers(): void {
    this.channel.onopen = () => {
      console.log(`Data publication ${this.publicationId} opened`);
      this.onOpen.execute();
    };

    this.channel.onclose = () => {
      console.log(`Data publication ${this.publicationId} closed`);
      this.onClose.execute();
    };

    this.channel.onerror = (error) => {
      console.error(`Data publication ${this.publicationId} error:`, error);
      this.onError.execute(error);
    };
  }

  send(data: string | ArrayBuffer | ArrayBufferView): void {
    if (this.channel.readyState === "open") {
      this.channel.send(data as any);
    } else {
      throw new Error(
        `Cannot send data: channel is ${this.channel.readyState}`,
      );
    }
  }

  close(): void {
    this.channel.close();
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
