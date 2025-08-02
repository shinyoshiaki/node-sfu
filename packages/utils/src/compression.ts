export interface FragmentedMessage {
  isFragment: true;
  messageId: string;
  fragmentIndex: number;
  totalFragments: number;
  payload: string;
}

export interface CompleteMessage {
  isFragment: false;
  payload: string;
}

export type MessageEnvelope = FragmentedMessage | CompleteMessage;

const FRAGMENT_SIZE_THRESHOLD = 512; // 512B threshold for fragmentation
const MAX_FRAGMENT_SIZE = 400; // Conservative fragment size to account for metadata

function generateMessageId(): string {
  return crypto.randomUUID();
}

export async function compressMessage(message: string): Promise<Uint8Array> {
  const stream = new CompressionStream("gzip");
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();

  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(message);

  writer.write(messageBytes);
  writer.close();

  const chunks: Uint8Array[] = [];
  let done = false;

  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (value) {
      chunks.push(value);
    }
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

export function createMessageEnvelope(message: string): MessageEnvelope[] {
  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(message);

  // Check if message exceeds fragmentation threshold
  if (messageBytes.length <= FRAGMENT_SIZE_THRESHOLD) {
    return [
      {
        isFragment: false,
        payload: message,
      },
    ];
  }

  // Fragment the message
  const messageId = generateMessageId();
  const fragments: FragmentedMessage[] = [];
  const totalFragments = Math.ceil(message.length / MAX_FRAGMENT_SIZE);

  for (let i = 0; i < totalFragments; i++) {
    const start = i * MAX_FRAGMENT_SIZE;
    const end = Math.min(start + MAX_FRAGMENT_SIZE, message.length);
    const payload = message.slice(start, end);

    fragments.push({
      isFragment: true,
      messageId,
      fragmentIndex: i,
      totalFragments,
      payload,
    });
  }

  return fragments;
}

export async function prepareMessagesForSending(
  message: string,
): Promise<Uint8Array[]> {
  const envelopes = createMessageEnvelope(message);
  const compressedMessages: Uint8Array[] = [];

  for (const envelope of envelopes) {
    const envelopeJson = JSON.stringify(envelope);
    const compressed = await compressMessage(envelopeJson);
    compressedMessages.push(compressed);
  }

  return compressedMessages;
}

export class MessageAssembler {
  private fragments = new Map<string, Map<number, FragmentedMessage>>();
  private readonly fragmentTimeout = 30000; // 30 seconds timeout
  private readonly timeouts = new Map<string, ReturnType<typeof setTimeout>>();

  processMessage(envelope: MessageEnvelope): string | null {
    if (!envelope.isFragment) {
      return envelope.payload;
    }

    const { messageId, fragmentIndex, totalFragments } = envelope;

    // Initialize fragment collection for this message
    if (!this.fragments.has(messageId)) {
      this.fragments.set(messageId, new Map());

      // Set timeout for fragment collection
      const timeout = setTimeout(() => {
        this.fragments.delete(messageId);
        this.timeouts.delete(messageId);
        console.warn(`Fragment timeout for message ${messageId}`);
      }, this.fragmentTimeout);

      this.timeouts.set(messageId, timeout);
    }

    const messageFragments = this.fragments.get(messageId)!;
    messageFragments.set(fragmentIndex, envelope);

    // Check if all fragments are received
    if (messageFragments.size === totalFragments) {
      // Clear timeout
      const timeout = this.timeouts.get(messageId);
      if (timeout) {
        clearTimeout(timeout);
        this.timeouts.delete(messageId);
      }

      // Reconstruct message
      const sortedFragments = Array.from(messageFragments.values()).sort(
        (a, b) => a.fragmentIndex - b.fragmentIndex,
      );

      const reconstructedMessage = sortedFragments
        .map((fragment) => fragment.payload)
        .join("");

      // Clean up
      this.fragments.delete(messageId);

      return reconstructedMessage;
    }

    return null; // Message not complete yet
  }

  cleanup(): void {
    // Clear all timeouts
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();
    this.fragments.clear();
  }
}

export async function decompressMessage(
  compressedData: Uint8Array,
): Promise<string> {
  const stream = new DecompressionStream("gzip");
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();

  writer.write(compressedData);
  writer.close();

  const chunks: Uint8Array[] = [];
  let done = false;

  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (value) {
      chunks.push(value);
    }
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  const decoder = new TextDecoder();
  return decoder.decode(result);
}
