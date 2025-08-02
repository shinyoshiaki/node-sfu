import type { JsonRpcTransport } from "../imports/json-rpc.js";
import {
  MessageAssembler,
  type MessageEnvelope,
  decompressMessage,
  prepareMessagesForSending,
} from "../imports/util.js";

export class MessageAssemblerTransport implements JsonRpcTransport {
  private messageAssembler = new MessageAssembler();
  private messageCallback?: (message: object) => void;

  constructor(private controlChannel: RTCDataChannel) {
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.controlChannel.onmessage = async (event) => {
      try {
        let envelopeText: string;
        const message = event.data;

        if (message instanceof ArrayBuffer) {
          const uint8Array = new Uint8Array(message);
          envelopeText = await decompressMessage(uint8Array);
        } else if (message instanceof Uint8Array) {
          envelopeText = await decompressMessage(message);
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
    };

    this.controlChannel.onclose = () => {
      this.messageAssembler.cleanup();
    };
  }

  async send(message: object): Promise<void> {
    if (this.controlChannel.readyState !== "open") {
      throw new Error("Control channel is not open");
    }

    try {
      const messageText = JSON.stringify(message);
      const compressedMessages = await prepareMessagesForSending(messageText);

      for (const compressedData of compressedMessages) {
        this.controlChannel.send(compressedData);
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
    // Note: We don't close the control channel here as it's managed by the client
  }
}
