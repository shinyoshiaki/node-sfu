import { beforeEach, describe, expect, it } from "vitest";
import {
  FRAGMENT_SIZE_THRESHOLD,
  FragmentationManager,
} from "../src/imports/util.js";

describe("FragmentationManager", () => {
  let fragmentationManager: FragmentationManager;

  beforeEach(() => {
    fragmentationManager = new FragmentationManager();
  });

  describe("fragmentData", () => {
    it(`should return single fragment for small data (≤${FRAGMENT_SIZE_THRESHOLD} bytes)`, () => {
      const smallData = "Hello, World!";
      const fragments = FragmentationManager.fragmentData(smallData);

      expect(fragments).toHaveLength(1);
    });

    it(`should fragment large data (>${FRAGMENT_SIZE_THRESHOLD} bytes) into multiple fragments`, () => {
      const largeData = "x".repeat(FRAGMENT_SIZE_THRESHOLD * 2.4); // 2.4 times the threshold
      const fragments = FragmentationManager.fragmentData(largeData);

      expect(fragments.length).toBeGreaterThan(1);
      expect(fragments.length).toBe(
        Math.ceil(largeData.length / FRAGMENT_SIZE_THRESHOLD),
      );
    });

    it("should handle ArrayBuffer input", () => {
      const buffer = new ArrayBuffer(FRAGMENT_SIZE_THRESHOLD * 1.6);
      const fragments = FragmentationManager.fragmentData(buffer);

      expect(fragments.length).toBe(2); // 1.6 times threshold = 2 fragments
    });

    it(`should handle exactly ${FRAGMENT_SIZE_THRESHOLD} byte threshold`, () => {
      const data = "x".repeat(FRAGMENT_SIZE_THRESHOLD);
      const fragments = FragmentationManager.fragmentData(data);

      expect(fragments).toHaveLength(1);
    });

    it(`should handle ${FRAGMENT_SIZE_THRESHOLD + 1} bytes (just over threshold)`, () => {
      const data = "x".repeat(FRAGMENT_SIZE_THRESHOLD + 1);
      const fragments = FragmentationManager.fragmentData(data);

      expect(fragments).toHaveLength(2);
    });
  });

  describe("processIncomingFragment", () => {
    it("should handle single fragment message", () => {
      const originalData = "Hello, World!";
      const fragments = FragmentationManager.fragmentData(originalData);

      const result = fragmentationManager.processIncomingFragment(fragments[0]);

      expect(result).not.toBeNull();
      expect(result).toBe(originalData);
    });

    it("should reassemble multiple fragments in order", () => {
      const originalData = "x".repeat(FRAGMENT_SIZE_THRESHOLD * 3); // This will create 3 fragments
      const fragments = FragmentationManager.fragmentData(originalData);

      expect(fragments.length).toBe(3);

      // Process fragments in order
      let result = fragmentationManager.processIncomingFragment(fragments[0]);
      expect(result).toBeNull(); // Not complete yet

      result = fragmentationManager.processIncomingFragment(fragments[1]);
      expect(result).toBeNull(); // Still not complete

      result = fragmentationManager.processIncomingFragment(fragments[2]);
      expect(result).not.toBeNull(); // Now complete

      expect(result).toBe(originalData);
    });

    it("should reassemble multiple fragments out of order", () => {
      const originalData = "x".repeat(FRAGMENT_SIZE_THRESHOLD * 3);
      const fragments = FragmentationManager.fragmentData(originalData);

      // Process fragments out of order
      let result = fragmentationManager.processIncomingFragment(fragments[2]);
      expect(result).toBeNull();

      result = fragmentationManager.processIncomingFragment(fragments[0]);
      expect(result).toBeNull();

      result = fragmentationManager.processIncomingFragment(fragments[1]);
      expect(result).not.toBeNull();

      expect(result).toBe(originalData);
    });

    it("should ignore duplicate fragments", () => {
      const originalData = "x".repeat(FRAGMENT_SIZE_THRESHOLD * 3);
      const fragments = FragmentationManager.fragmentData(originalData);

      // Process first fragment twice
      let result = fragmentationManager.processIncomingFragment(fragments[0]);
      expect(result).toBeNull();

      result = fragmentationManager.processIncomingFragment(fragments[0]); // Duplicate
      expect(result).toBeNull();

      result = fragmentationManager.processIncomingFragment(fragments[1]);
      expect(result).toBeNull();

      result = fragmentationManager.processIncomingFragment(fragments[2]);
      expect(result).not.toBeNull();

      expect(result).toBe(originalData);
    });

    it("should handle binary data correctly", () => {
      const originalBuffer = new ArrayBuffer(FRAGMENT_SIZE_THRESHOLD * 2);
      const view = new Uint8Array(originalBuffer);
      for (let i = 0; i < view.length; i++) {
        view[i] = i % 256; // Fill with test pattern
      }

      const fragments = FragmentationManager.fragmentData(originalBuffer);

      let result: ArrayBuffer | null = null;
      for (const fragment of fragments) {
        const fragmentResult =
          fragmentationManager.processIncomingFragment(fragment);
        if (fragmentResult) {
          result = fragmentResult as ArrayBuffer;
        }
      }

      expect(result).not.toBeNull();
      expect(result!.byteLength).toBe(originalBuffer.byteLength);

      const resultView = new Uint8Array(result!);
      for (let i = 0; i < resultView.length; i++) {
        expect(resultView[i]).toBe(i % 256);
      }
    });

    it("should handle various data sizes correctly", () => {
      const testSizes = [
        Math.floor(FRAGMENT_SIZE_THRESHOLD * 0.5),
        FRAGMENT_SIZE_THRESHOLD,
        FRAGMENT_SIZE_THRESHOLD + 1,
        FRAGMENT_SIZE_THRESHOLD * 2,
        FRAGMENT_SIZE_THRESHOLD * 3,
        FRAGMENT_SIZE_THRESHOLD * 20,
      ];

      for (const size of testSizes) {
        const fragmentationManager = new FragmentationManager();
        const originalData = "x".repeat(size);
        const fragments = FragmentationManager.fragmentData(originalData);

        let result: ArrayBuffer | string | null = null;
        for (const fragment of fragments) {
          const fragmentResult =
            fragmentationManager.processIncomingFragment(fragment);
          if (fragmentResult) {
            result = fragmentResult;
          }
        }

        expect(result).not.toBeNull();
        expect(result).toBe(originalData);
      }
    });
  });

  describe("cleanup", () => {
    it("should clean up incomplete fragment clusters", () => {
      const originalData = "x".repeat(FRAGMENT_SIZE_THRESHOLD * 3);
      const fragments = FragmentationManager.fragmentData(originalData);

      // Process only first fragment
      const result = fragmentationManager.processIncomingFragment(fragments[0]);
      expect(result).toBeNull();

      // Clean up
      fragmentationManager.cleanup();

      // Try to complete the message after cleanup - should not work
      const result2 = fragmentationManager.processIncomingFragment(
        fragments[1],
      );
      expect(result2).toBeNull();
    });
  });
});
