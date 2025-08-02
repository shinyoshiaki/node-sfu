import { decode, encode } from "cbor2";

export interface Fragment {
  messageId: string;
  index: number;
  isClusterStart: boolean;
  isClusterEnd: boolean;
  payload: Uint8Array;
  type: "s" | "b"; // "s" for string, "b" for binary
}

export interface FragmentCluster {
  fragments: Map<number, Fragment>;
  startReceived: boolean;
  endReceived: boolean;
  expectedEndIndex?: number;
}

export const FRAGMENT_SIZE_THRESHOLD = 300;

export class FragmentationManager {
  private static fragmentIndexCounter = 0;
  private incomingClusters = new Map<string, FragmentCluster>();

  static fragmentData(data: string | ArrayBuffer): ArrayBuffer[] {
    let buffer: ArrayBuffer;

    if (typeof data === "string") {
      const encoded = new TextEncoder().encode(data);
      buffer = encoded.buffer.slice(
        encoded.byteOffset,
        encoded.byteOffset + encoded.byteLength,
      ) as ArrayBuffer;
    } else {
      buffer = data;
    }

    const messageId = crypto.randomUUID();

    if (buffer.byteLength <= FRAGMENT_SIZE_THRESHOLD) {
      const fragment: Fragment = {
        messageId,
        index: 0,
        isClusterStart: true,
        isClusterEnd: true,
        payload: new Uint8Array(buffer),
        type: typeof data === "string" ? "s" : "b",
      };
      const encoded = encode(fragment);
      return [
        encoded.buffer.slice(
          encoded.byteOffset,
          encoded.byteOffset + encoded.byteLength,
        ) as ArrayBuffer,
      ];
    }

    const fragments: ArrayBuffer[] = [];
    const totalFragments = Math.ceil(
      buffer.byteLength / FRAGMENT_SIZE_THRESHOLD,
    );

    for (let i = 0; i < totalFragments; i++) {
      const start = i * FRAGMENT_SIZE_THRESHOLD;
      const end = Math.min(start + FRAGMENT_SIZE_THRESHOLD, buffer.byteLength);
      const payload = new Uint8Array(buffer.slice(start, end));

      const fragment: Fragment = {
        messageId,
        index: i,
        isClusterStart: i === 0,
        isClusterEnd: i === totalFragments - 1,
        payload,
        type: typeof data === "string" ? "s" : "b",
      };

      const encoded = encode(fragment);
      fragments.push(
        encoded.buffer.slice(
          encoded.byteOffset,
          encoded.byteOffset + encoded.byteLength,
        ) as ArrayBuffer,
      );
    }

    return fragments;
  }

  processIncomingFragment(
    fragmentData: ArrayBuffer,
  ): ArrayBuffer | string | null {
    try {
      const fragment = decode(new Uint8Array(fragmentData)) as Fragment;

      if (fragment.isClusterStart && fragment.isClusterEnd) {
        if (fragment.payload instanceof Uint8Array) {
          const reassembledData = fragment.payload.buffer.slice(
            fragment.payload.byteOffset,
            fragment.payload.byteOffset + fragment.payload.byteLength,
          ) as ArrayBuffer;
          return fragment.type === "s"
            ? new TextDecoder().decode(reassembledData)
            : reassembledData;
        } else {
          // CBOR might have decoded it as a regular array, convert it back
          return new Uint8Array(fragment.payload).buffer as ArrayBuffer;
        }
      }

      let cluster = this.incomingClusters.get(fragment.messageId);

      if (!cluster) {
        cluster = {
          fragments: new Map(),
          startReceived: false,
          endReceived: false,
        };
        this.incomingClusters.set(fragment.messageId, cluster);
      }

      if (cluster.fragments.has(fragment.index)) {
        return null;
      }

      cluster.fragments.set(fragment.index, fragment);

      if (fragment.isClusterStart) {
        cluster.startReceived = true;
      }

      if (fragment.isClusterEnd) {
        cluster.endReceived = true;
        cluster.expectedEndIndex = fragment.index;
      }

      if (this.isClusterComplete(cluster)) {
        const reassembledData = this.reassembleCluster(cluster);
        this.cleanupCluster(fragment.messageId);
        return fragment.type === "s"
          ? new TextDecoder().decode(reassembledData)
          : reassembledData;
      }

      return null;
    } catch (error) {
      console.error("Failed to process fragment:", error);
      return null;
    }
  }

  private isClusterComplete(cluster: FragmentCluster): boolean {
    if (
      !cluster.startReceived ||
      !cluster.endReceived ||
      cluster.expectedEndIndex === undefined
    ) {
      return false;
    }

    const sortedFragments = Array.from(cluster.fragments.values()).sort(
      (a, b) => a.index - b.index,
    );

    for (let i = 1; i < sortedFragments.length; i++) {
      if (sortedFragments[i].index !== sortedFragments[i - 1].index + 1) {
        return false;
      }
    }

    return true;
  }

  private reassembleCluster(cluster: FragmentCluster): ArrayBuffer {
    const sortedFragments = Array.from(cluster.fragments.values()).sort(
      (a, b) => a.index - b.index,
    );

    const totalLength = sortedFragments.reduce((sum, fragment) => {
      const payload =
        fragment.payload instanceof Uint8Array
          ? fragment.payload
          : new Uint8Array(fragment.payload);
      return sum + payload.byteLength;
    }, 0);
    const reassembled = new ArrayBuffer(totalLength);
    const view = new Uint8Array(reassembled);

    let offset = 0;
    for (const fragment of sortedFragments) {
      const payload =
        fragment.payload instanceof Uint8Array
          ? fragment.payload
          : new Uint8Array(fragment.payload);
      view.set(payload, offset);
      offset += payload.byteLength;
    }

    return reassembled;
  }

  private cleanupCluster(messageId: string): void {
    this.incomingClusters.delete(messageId);
  }

  cleanup(): void {
    this.incomingClusters.clear();
  }
}
