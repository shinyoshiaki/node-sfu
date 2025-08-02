/**
 * Transport abstraction interface for JSON RPC
 */

export interface JsonRpcTransport {
  /**
   * Send a message through the transport
   */
  send(message: object): Promise<void>;

  /**
   * Register a message handler for incoming messages
   */
  onMessage(callback: (message: object) => void): void;

  /**
   * Close the transport connection
   */
  close(): Promise<void>;
}
