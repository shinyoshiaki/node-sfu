import type { JsonRpcTransport } from "../imports/json-rpc.js";
import {
  MessageAssembler,
  type MessageEnvelope,
  decompressMessage,
  prepareMessagesForSending,
} from "../imports/util.js";
import type { RTCDataChannel } from "../imports/werift.js";

export class MessageAssemblerTransport implements JsonRpcTransport {
  private messageAssembler = new MessageAssembler();
  private messageCallback?: (message: object) => void;

  constructor(private controlChannel: RTCDataChannel) {
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.controlChannel.onMessage.subscribe(async (message) => {
      try {
        let envelopeText: string;
        if (message instanceof Uint8Array || Buffer.isBuffer(message)) {
          const uint8Array = Buffer.isBuffer(message)
            ? new Uint8Array(message)
            : message;
          envelopeText = await decompressMessage(uint8Array);
        } else {
          envelopeText = message as string;
        }

        const envelope: MessageEnvelope = JSON.parse(envelopeText);
        const reconstructedMessage =
          this.messageAssembler.processMessage(envelope);

        if (reconstructedMessage !== null && this.messageCallback) {
          const jsonMessage = JSON.parse(reconstructedMessage);
          this.messageCallback(jsonMessage);
        }
      } catch (error) {
        console.error("Failed to parse JSON RPC message:", error);
      }
    });

    this.controlChannel.onClose.subscribe(() => {
      this.messageAssembler.cleanup();
    });
  }

  async send(message: object): Promise<void> {
    if (this.controlChannel.readyState !== "open") {
      const e = await this.controlChannel.onOpen
        .asPromise(10_000, "Control channel not open")
        .catch((e) => ({ e }));
      if ("e" in e) {
        console.error("Control channel is not open:", e.e);
        return;
      }
    }

    try {
      const messageText = JSON.stringify(message);
      const compressedMessages = await prepareMessagesForSending(messageText);

      for (const compressedData of compressedMessages) {
        this.controlChannel.send(Buffer.from(compressedData));
      }
    } catch (error) {
      throw new Error(`Failed to send message: ${error}`);
    }
  }

  onMessage(callback: (message: object) => void): void {
    this.messageCallback = callback;
  }

  async close(): Promise<void> {
    this.messageAssembler.cleanup();
    // Note: We don't close the control channel here as it's managed by the member
  }
}
