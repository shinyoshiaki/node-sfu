import { Event } from "../../../submodules/werift/packages/common/src/event.js";
import type { RTCDataChannel } from "../../../submodules/werift/packages/webrtc/src/index.js";
import { FragmentationManager } from "./imports/util.js";

export function parseDataChannelLabel(label: string): {
  publicationId: string;
  metadata: Record<string, any>;
} {
  if (!label.startsWith("pub_")) {
    throw new Error(`Invalid data channel label: ${label}`);
  }

  const parts = label.substring(4).split("__");
  const publicationId = parts[0];

  let metadata: Record<string, any> = {};
  if (parts.length > 1) {
    try {
      metadata = JSON.parse(decodeURIComponent(parts[1]));
    } catch (error) {
      console.warn(`Failed to parse metadata from label: ${label}`, error);
    }
  }

  return { publicationId, metadata };
}

export function createDataChannelLabel(
  publicationId: string,
  metadata: Record<string, any> = {},
): string {
  if (Object.keys(metadata).length === 0) {
    return `pub_${publicationId}`;
  }
  const encodedMetadata = encodeURIComponent(JSON.stringify(metadata));
  return `pub_${publicationId}__${encodedMetadata}`;
}

export class DataPublication {
  readonly publicationId: string;
  readonly memberId: string;
  readonly metadata: Record<string, any>;
  private channel: RTCDataChannel;
  private fragmentationManager = new FragmentationManager();

  // Events
  readonly onMessage = new Event<[string | ArrayBuffer]>();
  readonly onOpen = new Event<[]>();
  readonly onClose = new Event<[]>();
  readonly onError = new Event<[any]>();

  constructor(
    publicationId: string,
    memberId: string,
    channel: RTCDataChannel,
    metadata: Record<string, any> = {},
  ) {
    this.publicationId = publicationId;
    this.memberId = memberId;
    this.metadata = metadata;
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
        this.channel.send(Buffer.from(fragment));
      }
    } else {
      throw new Error(
        `Cannot send data: channel is ${this.channel.readyState}`,
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
