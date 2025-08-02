import { Event } from "../../../submodules/werift/packages/common/src/event.js";
import { FragmentationManager } from "./imports/util.js";

export class DataPublication {
  readonly publicationId: string;
  readonly metadata: Record<string, any>;
  private channel: RTCDataChannel;

  // Events
  readonly onOpen = new Event<[]>();
  readonly onClose = new Event<[]>();
  readonly onError = new Event<[any]>();

  constructor(
    publicationId: string,
    channel: RTCDataChannel,
    metadata: Record<string, any> = {},
  ) {
    this.publicationId = publicationId;
    this.metadata = metadata;
    this.channel = channel;
    this.setupChannelHandlers();
  }

  async _waitForOpen(timeout: number = 5000): Promise<void> {
    if (this.channel.readyState === "open") {
      return;
    }
    await this.onOpen.asPromise(timeout, "DataPublication waitForOpen timeout");
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
      let inputData: string | ArrayBuffer;
      if (typeof data === "string" || data instanceof ArrayBuffer) {
        inputData = data;
      } else {
        // Handle ArrayBufferView (Uint8Array, DataView, etc.)
        const buffer = data.buffer;
        inputData = buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength,
        ) as ArrayBuffer;
      }

      const fragments = FragmentationManager.fragmentData(inputData);
      for (const fragment of fragments) {
        this.channel.send(fragment);
      }
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
