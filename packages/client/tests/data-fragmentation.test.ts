import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataPublication } from "../src/dataPublication.js";
import { DataSubscription } from "../src/dataSubscription.js";

// Mock RTCDataChannel with proper typing
interface MockRTCDataChannel extends RTCDataChannel {
  sentData: ArrayBuffer[];
  simulateMessage(data: ArrayBuffer): void;
  simulateOpen(): void;
}

class MockRTCDataChannelImpl implements MockRTCDataChannel {
  label = "test";
  readyState = "open" as RTCDataChannelState;

  onopen: ((this: RTCDataChannel, ev: Event) => any) | null = null;
  onclose: ((this: RTCDataChannel, ev: Event) => any) | null = null;
  onerror: ((this: RTCDataChannel, ev: Event) => any) | null = null;
  onmessage: ((this: RTCDataChannel, ev: MessageEvent) => any) | null = null;

  sentData: ArrayBuffer[] = [];

  // RTCDataChannel properties that we need to mock
  binaryType: BinaryType = "arraybuffer";
  bufferedAmount = 0;
  bufferedAmountLowThreshold = 0;
  id: number | null = null;
  maxPacketLifeTime: number | null = null;
  maxRetransmits: number | null = null;
  negotiated = false;
  ordered = true;
  protocol = "";

  // RTCDataChannel event handlers
  onbufferedamountlow: ((this: RTCDataChannel, ev: Event) => any) | null = null;
  onclosing: ((this: RTCDataChannel, ev: Event) => any) | null = null;

  send(data: string | Blob | ArrayBuffer | ArrayBufferView): void {
    if (data instanceof ArrayBuffer) {
      this.sentData.push(data);
    } else if (typeof data === "string") {
      const encoded = new TextEncoder().encode(data);
      this.sentData.push(
        encoded.buffer.slice(
          encoded.byteOffset,
          encoded.byteOffset + encoded.byteLength,
        ) as ArrayBuffer,
      );
    } else if (data instanceof Blob) {
      // Handle Blob (not supported in our mock, but required by interface)
      throw new Error("Blob not supported in mock");
    } else {
      // Handle ArrayBufferView
      const view = data as ArrayBufferView;
      this.sentData.push(
        view.buffer.slice(
          view.byteOffset,
          view.byteOffset + view.byteLength,
        ) as ArrayBuffer,
      );
    }
  }

  close(): void {
    this.readyState = "closed";
  }

  simulateMessage(data: ArrayBuffer): void {
    if (this.onmessage) {
      this.onmessage.call(this, { data } as MessageEvent);
    }
  }

  simulateOpen(): void {
    if (this.onopen) {
      this.onopen.call(this, {} as Event);
    }
  }

  // EventTarget methods
  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return true;
  }
}

describe("Data Channel Fragmentation Integration", () => {
  let mockChannel: MockRTCDataChannel;
  let publication: DataPublication;
  let subscription: DataSubscription;

  beforeEach(() => {
    mockChannel = new MockRTCDataChannelImpl();
  });

  describe("DataPublication with fragmentation", () => {
    beforeEach(() => {
      publication = new DataPublication("test-pub", mockChannel as any);
    });

    it("should send small data as single fragment", () => {
      const smallData = "Hello, World!";
      publication.send(smallData);

      expect(mockChannel.sentData).toHaveLength(1);
    });

    it("should fragment large data into multiple parts", () => {
      const largeData = "x".repeat(1200); // 1200 bytes, should be fragmented
      publication.send(largeData);

      expect(mockChannel.sentData.length).toBeGreaterThan(1);
    });

    it("should handle ArrayBuffer input", () => {
      const buffer = new ArrayBuffer(800);
      publication.send(buffer);

      expect(mockChannel.sentData.length).toBeGreaterThan(1);
    });

    it("should handle ArrayBufferView input", () => {
      const buffer = new ArrayBuffer(800);
      const view = new Uint8Array(buffer);
      publication.send(view);

      expect(mockChannel.sentData.length).toBeGreaterThan(1);
    });
  });

  describe("DataSubscription with fragmentation", () => {
    beforeEach(() => {
      subscription = new DataSubscription(
        "test-sub",
        "test-pub",
        mockChannel as any,
      );
    });

    it("should receive single fragment message", () => {
      const receivedMessages: string[] = [];
      subscription.onMessage.subscribe((data) => {
        receivedMessages.push(data as string);
      });

      // Send a small message that fits in single fragment
      const testPub = new DataPublication(
        "test",
        new MockRTCDataChannelImpl() as any,
      );
      const smallData = "Hello, World!";
      testPub.send(smallData);

      // Get the fragment and simulate receiving it
      const fragment = (testPub as any).channel.sentData[0];
      (subscription.channel as MockRTCDataChannel).simulateMessage(fragment);

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0]).toBe(smallData);
    });

    it("should reassemble fragmented message", () => {
      const receivedMessages: string[] = [];
      subscription.onMessage.subscribe((data) => {
        receivedMessages.push(data as string);
      });

      // Send a large message that gets fragmented
      const testPub = new DataPublication(
        "test",
        new MockRTCDataChannelImpl() as any,
      );
      const largeData = "x".repeat(1200);
      testPub.send(largeData);

      // Get all fragments and simulate receiving them in order
      const fragments = (testPub as any).channel.sentData;
      expect(fragments.length).toBeGreaterThan(1);

      for (const fragment of fragments) {
        (subscription.channel as MockRTCDataChannel).simulateMessage(fragment);
      }

      // Should have received exactly one reassembled message
      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0]).toBe(largeData);
    });

    it("should reassemble fragmented message received out of order", () => {
      const receivedMessages: string[] = [];
      subscription.onMessage.subscribe((data) => {
        receivedMessages.push(data as string);
      });

      // Send a large message that gets fragmented
      const testPub = new DataPublication(
        "test",
        new MockRTCDataChannelImpl() as any,
      );
      const largeData = "x".repeat(1200);
      testPub.send(largeData);

      // Get all fragments and simulate receiving them out of order
      const fragments = (testPub as any).channel.sentData;
      expect(fragments.length).toBeGreaterThan(1);

      // Send fragments in reverse order
      for (let i = fragments.length - 1; i >= 0; i--) {
        (subscription.channel as MockRTCDataChannel).simulateMessage(
          fragments[i],
        );
      }

      // Should have received exactly one reassembled message
      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0]).toBe(largeData);
    });

    it("should handle multiple concurrent messages", () => {
      const receivedMessages: string[] = [];
      subscription.onMessage.subscribe((data) => {
        receivedMessages.push(data as string);
      });

      // Send two different large messages
      const testPub1 = new DataPublication(
        "test1",
        new MockRTCDataChannelImpl() as any,
      );
      const testPub2 = new DataPublication(
        "test2",
        new MockRTCDataChannelImpl() as any,
      );

      const largeData1 = "A".repeat(1200);
      const largeData2 = "B".repeat(1200);

      testPub1.send(largeData1);
      testPub2.send(largeData2);

      const fragments1 = (testPub1 as any).channel.sentData;
      const fragments2 = (testPub2 as any).channel.sentData;

      // Interleave fragments from both messages
      const allFragments: ArrayBuffer[] = [];
      for (let i = 0; i < Math.max(fragments1.length, fragments2.length); i++) {
        if (i < fragments1.length) allFragments.push(fragments1[i]);
        if (i < fragments2.length) allFragments.push(fragments2[i]);
      }

      // Send all fragments
      for (const fragment of allFragments) {
        (subscription.channel as MockRTCDataChannel).simulateMessage(fragment);
      }

      // Should have received both messages
      expect(receivedMessages).toHaveLength(2);

      expect(receivedMessages).toContain(largeData1);
      expect(receivedMessages).toContain(largeData2);
    });
  });

  describe("End-to-end data channel communication", () => {
    it("should successfully send and receive various data sizes", () => {
      const testSizes = [50, 500, 501, 1000, 5000, 10000];

      for (const size of testSizes) {
        const pubChannel = new MockRTCDataChannelImpl();
        const subChannel = new MockRTCDataChannelImpl();

        const publication = new DataPublication("test-pub", pubChannel as any);
        const subscription = new DataSubscription(
          "test-sub",
          "test-pub",
          subChannel as any,
        );

        const receivedMessages: string[] = [];
        subscription.onMessage.subscribe((data) => {
          receivedMessages.push(data as string);
        });

        const testData = "x".repeat(size);
        publication.send(testData);

        // Forward all fragments from publication to subscription
        for (const fragment of pubChannel.sentData) {
          subChannel.simulateMessage(fragment);
        }

        expect(receivedMessages).toHaveLength(1);
        expect(receivedMessages[0]).toBe(testData);
      }
    });
  });
});
