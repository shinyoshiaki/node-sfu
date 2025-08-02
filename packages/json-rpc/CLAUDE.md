# CLAUDE.md - JSON-RPC Package

This file provides guidance to Claude Code when working with the JSON-RPC implementation of node-sfu.

@../../../CLAUDE.md

## Package Overview

The `packages/json-rpc/` directory contains a JSON-RPC 2.0 implementation for both Node.js and browser environments. This package provides structured communication protocols that can be used over various transport layers including WebRTC DataChannels.

## Architecture

### Core Components

**JsonRpc** (`src/jsonrpc.ts`):
- JSON-RPC 2.0 compliant implementation
- Support for requests, responses, notifications, and batch operations
- Transport-agnostic design with pluggable transport layer
- Request/response correlation with automatic timeout handling
- Error handling with standard JSON-RPC error codes

**Transport Layer** (`src/transport.ts`):
- Abstract transport interface for various communication channels
- Support for WebRTC DataChannels, WebSockets, HTTP, etc.
- Bidirectional message passing with send/onMessage pattern
- Transport-specific error handling
- `src/transports/` directory for future transport implementations

**Type Definitions** (`src/types.ts`):
- Complete TypeScript definitions for JSON-RPC 2.0 specification
- Request, response, notification, and error message types
- Handler interfaces for method implementations
- Configuration options and error codes

### Key Features

**JSON-RPC 2.0 Compliance**:
- Standard request/response pattern
- Notification support (fire-and-forget)
- Batch operations for multiple requests
- Standard error codes and error handling

**Transport Agnostic**:
- Pluggable transport layer architecture
- WebRTC DataChannel transport support
- WebSocket transport capability  
- HTTP transport for traditional JSON-RPC over HTTP

**Type Safety**:
- Full TypeScript support with strict typing
- Generic method parameter and return types
- Compile-time validation of JSON-RPC messages

## JSON-RPC Exports

```typescript
// Core JSON-RPC implementation
export { JsonRpc }

// Transport interface
export type { JsonRpcTransport }

// Error handling
export { JsonRpcErrorCode, JsonRpcException }

// Type definitions
export type {
  JsonRpcRequest,
  JsonRpcResponse, 
  JsonRpcNotification,
  JsonRpcMessage,
  JsonRpcError,
  JsonRpcOptions,
  RequestHandler,
  NotificationHandler
}
```

## Commands

```bash
# Type checking
npm run -w packages/json-rpc type

# Linting
npm run -w packages/json-rpc lint

# Run unit tests
npm run -w packages/json-rpc test
npm run -w packages/json-rpc test:watch

# Build package
npm run -w packages/json-rpc build

# Run from package directory
cd packages/json-rpc
npm run type
npm run lint
npm run test
npm run test:watch
npm run build
```

## Development Guidelines

### Design Principles

1. **Standards Compliance**: Strict adherence to JSON-RPC 2.0 specification
2. **Transport Agnostic**: Works with any bidirectional transport layer
3. **Type Safety**: Full TypeScript integration with generic method support
4. **Error Handling**: Comprehensive error handling with standard error codes
5. **Performance**: Efficient message serialization and correlation

### Implementation Patterns

**Basic Usage**:
```typescript
// Create JSON-RPC instance with transport
const jsonRpc = new JsonRpc(transport, {
  timeout: 5000
});

// Register method handlers
jsonRpc.addMethod('echo', (params) => {
  return params;
});

// Make requests
const result = await jsonRpc.request('echo', { message: 'Hello' });

// Send notifications
jsonRpc.notify('log', { level: 'info', message: 'Event occurred' });
```

**Transport Implementation**:
```typescript
class DataChannelTransport implements JsonRpcTransport {
  constructor(private dataChannel: RTCDataChannel) {}

  send(message: string): void {
    this.dataChannel.send(message);
  }

  onMessage(handler: (message: string) => void): void {
    this.dataChannel.onmessage = (event) => {
      handler(event.data);
    };
  }
}
```

**Error Handling**:
```typescript
try {
  const result = await jsonRpc.request('method', params);
} catch (error) {
  if (error.code === JsonRpcErrorCode.METHOD_NOT_FOUND) {
    console.log('Method not found');
  }
}
```

### Testing Integration

**Unit Tests** (`src/tests/jsonrpc.test.ts`):
- JSON-RPC message formatting and parsing
- Request/response correlation
- Error handling scenarios
- Notification processing
- Transport layer integration

**Test Configuration**:
- Uses Vitest for unit testing
- Mock transport implementations for testing
- Timeout: Standard test timeouts
- Coverage reporting for method handlers

### Integration Points

**With Core Package**:
- Control channel message formatting
- Structured communication between Room and Member
- Event serialization and deserialization

**With Client Package**:
- DataChannel transport integration
- Client-server communication protocol
- Method call abstraction over WebRTC

**With Reference Server**:
- HTTP transport for REST-like JSON-RPC endpoints
- WebSocket transport for real-time communication
- Batch request processing

### JSON-RPC Protocol Details

**Request Format**:
```json
{
  "jsonrpc": "2.0",
  "method": "methodName",
  "params": {...},
  "id": "unique-request-id"
}
```

**Response Format**:
```json
{
  "jsonrpc": "2.0",
  "result": {...},
  "id": "unique-request-id"
}
```

**Error Format**:
```json
{
  "jsonrpc": "2.0", 
  "error": {
    "code": -32000,
    "message": "Error description",
    "data": {...}
  },
  "id": "unique-request-id"
}
```

**Notification Format**:
```json
{
  "jsonrpc": "2.0",
  "method": "notificationName",
  "params": {...}
}
```