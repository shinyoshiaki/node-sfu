import { beforeEach, describe, expect, it, vi } from "vitest";
import { JsonRpc } from "../jsonrpc.js";
import type { JsonRpcTransport } from "../transport.js";
import { JsonRpcErrorCode } from "../types.js";

// Mock transport for testing
class MockTransport implements JsonRpcTransport {
  private messageHandler?: (message: object) => void;
  public sentMessages: object[] = [];

  async send(message: object): Promise<void> {
    this.sentMessages.push(message);
  }

  onMessage(callback: (message: object) => void): void {
    this.messageHandler = callback;
  }

  async close(): Promise<void> {
    // Mock close
  }

  // Test helper method to simulate receiving a message
  simulateMessage(message: object): void {
    if (this.messageHandler) {
      this.messageHandler(message);
    }
  }
}

describe("JsonRpc", () => {
  let transport: MockTransport;
  let jsonRpc: JsonRpc;

  beforeEach(() => {
    transport = new MockTransport();
    jsonRpc = new JsonRpc(transport);
  });

  describe("Request/Response", () => {
    it("should send a request and receive a response", async () => {
      const requestPromise = jsonRpc.request("test", { param: "value" });

      // Check that the request was sent
      expect(transport.sentMessages).toHaveLength(1);
      const sentRequest = transport.sentMessages[0] as any;
      expect(sentRequest).toMatchObject({
        jsonrpc: "2.0",
        method: "test",
        params: { param: "value" },
        id: expect.any(Number),
      });

      // Simulate response
      transport.simulateMessage({
        jsonrpc: "2.0",
        result: { success: true },
        id: sentRequest.id,
      });

      const result = await requestPromise;
      expect(result).toEqual({ success: true });
    });

    it("should handle request errors", async () => {
      const requestPromise = jsonRpc.request("test", { param: "value" });

      // Get the sent request ID
      const sentRequest = transport.sentMessages[0] as any;

      // Simulate error response
      transport.simulateMessage({
        jsonrpc: "2.0",
        error: {
          code: JsonRpcErrorCode.METHOD_NOT_FOUND,
          message: "Method not found",
        },
        id: sentRequest.id,
      });

      await expect(requestPromise).rejects.toThrow(
        "Method not found (code: -32601)",
      );
    });

    it("should timeout requests", async () => {
      const jsonRpcWithTimeout = new JsonRpc(transport, { timeout: 100 });

      const requestPromise = jsonRpcWithTimeout.request("test", {
        param: "value",
      });

      await expect(requestPromise).rejects.toThrow(
        "Request timeout for method: test",
      );
    });
  });

  describe("Notifications", () => {
    it("should send notifications", () => {
      jsonRpc.notify("testNotification", { param: "value" });

      expect(transport.sentMessages).toHaveLength(1);
      expect(transport.sentMessages[0]).toMatchObject({
        jsonrpc: "2.0",
        method: "testNotification",
        params: { param: "value" },
      });

      // Notifications should not have an ID
      expect((transport.sentMessages[0] as any).id).toBeUndefined();
    });

    it("should handle received notifications", () => {
      const handler = vi.fn();
      jsonRpc.onNotification("testNotification", handler);

      transport.simulateMessage({
        jsonrpc: "2.0",
        method: "testNotification",
        params: { param: "value" },
      });

      expect(handler).toHaveBeenCalledWith({ param: "value" });
    });
  });

  describe("Request Handlers", () => {
    it("should handle incoming requests", async () => {
      const handler = vi.fn().mockResolvedValue({ result: "success" });
      jsonRpc.onRequest("testMethod", handler);

      transport.simulateMessage({
        jsonrpc: "2.0",
        method: "testMethod",
        params: { param: "value" },
        id: 123,
      });

      // Give it time to process
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith({ param: "value" });

      // Check that a response was sent
      expect(transport.sentMessages).toHaveLength(1);
      expect(transport.sentMessages[0]).toMatchObject({
        jsonrpc: "2.0",
        result: { result: "success" },
        id: 123,
      });
    });

    it("should handle request handler errors", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("Handler error"));
      jsonRpc.onRequest("testMethod", handler);

      transport.simulateMessage({
        jsonrpc: "2.0",
        method: "testMethod",
        params: { param: "value" },
        id: 123,
      });

      // Give it time to process
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Check that an error response was sent
      expect(transport.sentMessages).toHaveLength(1);
      expect(transport.sentMessages[0]).toMatchObject({
        jsonrpc: "2.0",
        error: {
          code: JsonRpcErrorCode.INTERNAL_ERROR,
          message: "Handler error",
        },
        id: 123,
      });
    });

    it("should send method not found error for unknown methods", async () => {
      transport.simulateMessage({
        jsonrpc: "2.0",
        method: "unknownMethod",
        params: { param: "value" },
        id: 123,
      });

      // Give it time to process
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(transport.sentMessages).toHaveLength(1);
      expect(transport.sentMessages[0]).toMatchObject({
        jsonrpc: "2.0",
        error: {
          code: JsonRpcErrorCode.METHOD_NOT_FOUND,
          message: "Method not found: unknownMethod",
        },
        id: 123,
      });
    });
  });
});
