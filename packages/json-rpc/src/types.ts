/**
 * JSON RPC 2.0 types and interfaces
 */

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: object | any[];
  id: string | number;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  result?: any;
  error?: JsonRpcError;
  id: string | number | null;
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: object | any[];
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

export enum JsonRpcErrorCode {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,

  // Custom errors (-32099 to -32000)
  PUBLICATION_NOT_FOUND = -32001,
  SUBSCRIPTION_FAILED = -32002,
  MEDIA_PUBLISH_FAILED = -32003,
  PERMISSION_DENIED = -32004,
  ROOM_FULL = -32005,
}

export type JsonRpcMessage =
  | JsonRpcRequest
  | JsonRpcResponse
  | JsonRpcNotification;

export type RequestHandler<T = any> = (params?: any) => Promise<T> | T;
export type NotificationHandler = (params?: any) => void;

export interface JsonRpcOptions {
  timeout?: number;
}

/**
 * JSON-RPC Error class for throwing structured errors
 */
export class JsonRpcException extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: any,
  ) {
    super(message);
    this.name = "JsonRpcException";
  }
}
