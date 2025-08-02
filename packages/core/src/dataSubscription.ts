import { Event } from "../../../submodules/werift/packages/common/src/event.js";
import type { RTCDataChannel } from "../../../submodules/werift/packages/webrtc/src/index.js";
import { FragmentationManager } from "./imports/util.js";

export class DataSubscription {
  readonly subscriptionId: string;
  readonly publicationId: string;
  readonly subscriberMemberId: string;
  private channel: RTCDataChannel;
  private fragmentationManager = new FragmentationManager();

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
      let fragmentData: ArrayBuffer;
      if (data instanceof ArrayBuffer) {
        fragmentData = data;
      } else {
        // Handle Buffer or other types from werift
        const uint8Array = new Uint8Array(data as any);
        fragmentData = uint8Array.buffer.slice(
          uint8Array.byteOffset,
          uint8Array.byteOffset + uint8Array.byteLength,
        );
      }

      const reassembledData =
        this.fragmentationManager.processIncomingFragment(fragmentData);
      if (reassembledData !== null) {
        this.onMessage.execute(reassembledData);
      }
    });
  }

  forwardMessage(data: string | ArrayBuffer): void {
    if (this.channel.readyState === "open") {
      const fragments = FragmentationManager.fragmentData(data);
      for (const fragment of fragments) {
        this.channel.send(Buffer.from(fragment));
      }
    } else {
      console.warn(
        `Cannot forward message to subscription ${this.subscriptionId}: channel is ${this.channel.readyState}`,
      );
    }
  }

  close(): void {
    this.fragmentationManager.cleanup();
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
