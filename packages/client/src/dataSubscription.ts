import { Event } from "../../../submodules/werift/packages/common/src/event.js";
import { FragmentationManager } from "./imports/util.js";

export class DataSubscription {
  readonly subscriptionId: string;
  readonly publicationId: string;
  channel: RTCDataChannel;
  private fragmentationManager = new FragmentationManager();

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

  async waitForOpen(timeout: number = 5000): Promise<void> {
    if (this.channel.readyState === "open") {
      return;
    }
    await this.onOpen.asPromise(
      timeout,
      "DataSubscription waitForOpen timeout",
    );
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
      const reassembledData = this.fragmentationManager.processIncomingFragment(
        data as ArrayBuffer,
      );
      if (reassembledData !== null) {
        this.onMessage.execute(reassembledData);
      }
    };
  }

  close(): void {
    this.fragmentationManager.cleanup();
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
