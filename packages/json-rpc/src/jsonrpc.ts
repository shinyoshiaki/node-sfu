import type { JsonRpcTransport } from "./transport.js";
import {
  JsonRpcError,
  JsonRpcErrorCode,
  JsonRpcException,
  type JsonRpcMessage,
  type JsonRpcNotification,
  type JsonRpcOptions,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type NotificationHandler,
  type RequestHandler,
} from "./types.js";

export class JsonRpc {
  private transport: JsonRpcTransport;
  private options: JsonRpcOptions;
  private requestId = 1;
  private pendingRequests = new Map<
    string | number,
    {
      resolve: (result: any) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();
  private requestHandlers = new Map<string, RequestHandler>();
  private notificationHandlers = new Map<string, NotificationHandler>();

  constructor(transport: JsonRpcTransport, options: JsonRpcOptions = {}) {
    this.transport = transport;
    this.options = {
      timeout: 5000,
      ...options,
    };

    // Set up message handling
    this.transport.onMessage((message) => {
      this.handleMessage(message as JsonRpcMessage);
    });
  }

  /**
   * Send a request and wait for a response
   */
  async request<T = any>(method: string, params?: any): Promise<T> {
    const id = this.generateId();
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      method,
      params,
      id,
    };

    return new Promise<T>((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout for method: ${method}`));
      }, this.options.timeout);

      // Store pending request
      this.pendingRequests.set(id, {
        resolve,
        reject,
        timeout,
      });

      // Send request
      this.transport.send(request).catch((error) => {
        this.pendingRequests.delete(id);
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Send a notification (no response expected)
   */
  notify(method: string, params?: any): void {
    const notification: JsonRpcNotification = {
      jsonrpc: "2.0",
      method,
      params,
    };

    this.transport.send(notification).catch((error) => {
      console.error("Failed to send notification:", error);
    });
  }

  /**
   * Register a handler for incoming requests
   */
  onRequest<T = any>(method: string, handler: RequestHandler<T>): void {
    this.requestHandlers.set(method, handler);
  }

  /**
   * Register a handler for incoming notifications
   */
  onNotification(method: string, handler: NotificationHandler): void {
    this.notificationHandlers.set(method, handler);
  }

  /**
   * Close the JSON RPC connection
   */
  async close(): Promise<void> {
    // Clear all pending requests
    for (const [id, { timeout }] of this.pendingRequests) {
      clearTimeout(timeout);
    }
    this.pendingRequests.clear();

    // Close transport
    await this.transport.close();
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: JsonRpcMessage): void {
    try {
      if (this.isRequest(message)) {
        this.handleRequest(message);
      } else if (this.isResponse(message)) {
        this.handleResponse(message);
      } else if (this.isNotification(message)) {
        this.handleNotification(message);
      } else {
        console.error("Invalid JSON RPC message:", message);
      }
    } catch (error) {
      console.error("Error handling JSON RPC message:", error);
    }
  }

  /**
   * Handle incoming requests
   */
  private async handleRequest(request: JsonRpcRequest): Promise<void> {
    const { method, params, id } = request;
    const handler = this.requestHandlers.get(method);

    if (!handler) {
      await this.sendError(
        id,
        JsonRpcErrorCode.METHOD_NOT_FOUND,
        `Method not found: ${method}`,
      );
      return;
    }

    try {
      const result = await handler(params);
      await this.sendResult(id, result);
    } catch (error) {
      if (error instanceof JsonRpcException) {
        await this.sendError(id, error.code, error.message, error.data);
      } else {
        await this.sendError(
          id,
          JsonRpcErrorCode.INTERNAL_ERROR,
          error instanceof Error ? error.message : "Internal error",
        );
      }
    }
  }

  /**
   * Handle incoming responses
   */
  private handleResponse(response: JsonRpcResponse): void {
    const { id, result, error } = response;

    if (id === null) {
      console.warn("Received response with null ID");
      return;
    }

    const pending = this.pendingRequests.get(id);

    if (!pending) {
      console.warn(`Received response for unknown request ID: ${id}`);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(id);

    if (error) {
      pending.reject(new Error(`${error.message} (code: ${error.code})`));
    } else {
      pending.resolve(result);
    }
  }

  /**
   * Handle incoming notifications
   */
  private handleNotification(notification: JsonRpcNotification): void {
    const { method, params } = notification;
    const handler = this.notificationHandlers.get(method);

    if (!handler) {
      console.warn(`No handler for notification: ${method}`);
      return;
    }

    try {
      handler(params);
    } catch (error) {
      console.error(`Error in notification handler for ${method}:`, error);
    }
  }

  /**
   * Send a successful result
   */
  private async sendResult(id: string | number, result: any): Promise<void> {
    const response: JsonRpcResponse = {
      jsonrpc: "2.0",
      result,
      id,
    };

    await this.transport.send(response);
  }

  /**
   * Send an error response
   */
  private async sendError(
    id: string | number,
    code: number,
    message: string,
    data?: any,
  ): Promise<void> {
    const response: JsonRpcResponse = {
      jsonrpc: "2.0",
      error: {
        code,
        message,
        data,
      },
      id,
    };

    await this.transport.send(response);
  }

  /**
   * Generate unique request ID
   */
  private generateId(): string | number {
    return this.requestId++;
  }

  /**
   * Type guards
   */
  private isRequest(message: JsonRpcMessage): message is JsonRpcRequest {
    return (
      "id" in message &&
      "method" in message &&
      !("result" in message || "error" in message)
    );
  }

  private isResponse(message: JsonRpcMessage): message is JsonRpcResponse {
    return (
      "id" in message &&
      ("result" in message || "error" in message) &&
      !("method" in message)
    );
  }

  private isNotification(
    message: JsonRpcMessage,
  ): message is JsonRpcNotification {
    return "method" in message && !("id" in message);
  }
}
