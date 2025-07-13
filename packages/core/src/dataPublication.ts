import { Event } from "../../../submodules/werift/packages/common/src/event.js";
import type { RTCDataChannel } from "../../../submodules/werift/packages/webrtc/src/index.js";

export class DataPublication {
  readonly publicationId: string;
  readonly memberId: string;
  private channel: RTCDataChannel;

  // Events
  readonly onMessage = new Event<[string | ArrayBuffer]>();
  readonly onOpen = new Event<[]>();
  readonly onClose = new Event<[]>();
  readonly onError = new Event<[any]>();

  constructor(
    publicationId: string,
    memberId: string,
    channel: RTCDataChannel,
  ) {
    this.publicationId = publicationId;
    this.memberId = memberId;
    this.channel = channel;
    this.setupChannelHandlers();
  }

  private setupChannelHandlers(): void {
    this.channel.onOpen.subscribe(() => {
      console.log(
        `Data publication ${this.publicationId} from member ${this.memberId} opened`,
      );
      this.onOpen.execute();
    });

    this.channel.onClose.subscribe(() => {
      console.log(
        `Data publication ${this.publicationId} from member ${this.memberId} closed`,
      );
      this.onClose.execute();
    });

    this.channel.onError.subscribe((error) => {
      console.error(
        `Data publication ${this.publicationId} from member ${this.memberId} error:`,
        error,
      );
      this.onError.execute(error);
    });

    this.channel.onMessage.subscribe((data) => {
      this.onMessage.execute(data as string | ArrayBuffer);
    });
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
