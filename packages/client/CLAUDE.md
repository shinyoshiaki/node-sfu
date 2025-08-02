# CLAUDE.md - Client Package

This file provides guidance to Claude Code when working with the client-side WebRTC implementation of node-sfu.

@../../../CLAUDE.md

## Package Overview

The `packages/client/` directory contains the WebRTC client implementation for connecting to the node-sfu. This package provides the client-side API for publishing and subscribing to data and media channels.

## Architecture

### Core Classes

**Client** (`src/index.ts`):
- Main WebRTC client with static factory method `Client.create()`
- Modular architecture with delegation pattern:
  - ConnectionManager for PeerConnection lifecycle management
  - Publisher for data and media publication management
  - Subscriber for subscription handling and remote member tracking
  - JsonRpc integration for structured control channel communication
  - PromiseQueue integration for reliable operation sequencing
- Supports dependency injection for testing (custom RTCPeerConnection)
- Enhanced connection stability with `onConnected` event
- Configurable ICE servers and comprehensive error handling
- Automatic ping mechanism for connection maintenance

**ConnectionManager** (`src/connectionManager.ts`):
- Dedicated PeerConnection management and lifecycle handling
- ICE candidate processing with trickle ICE support
- Connection state monitoring and recovery
- Event-driven architecture with proper cleanup

**Publisher** (`src/publisher.ts`):
- Manages data and media publications including screen sharing
- PromiseQueue integration for asynchronous operation reliability
- Publication lifecycle management with proper cleanup
- Support for multiple concurrent media streams

**Subscriber** (`src/subscriber.ts`):
- Handles subscription management for data and media channels
- Remote stream processing and event handling
- Subscription lifecycle with automatic cleanup
- Multi-stream subscription support

**Publication Classes**:
- `DataPublication` (`src/dataPublication.ts`) - Client-side data publication
- `MediaPublication` (`src/mediaPublication.ts`) - Client-side media publication

**Subscription Classes**:
- `DataSubscription` (`src/dataSubscription.ts`) - Client-side data subscription
- `MediaSubscription` (`src/mediaSubscription.ts`) - Client-side media subscription

### Key Features

**Configuration Options**:
```typescript
interface ClientConfig {
  peerConnection?: RTCPeerConnection;  // For dependency injection
  iceServers?: RTCIceServer[];        // Custom ICE configuration
}
```

**Connection Management**:
- Automatic control channel setup (label: `sfu`)
- Enhanced connection state tracking with `onConnected` event
- Support for trickle ICE via dedicated API endpoint
- Connection stability improvements with retry logic

**Communication Patterns**:
- **Data Flow**: DataPublication → Control Channel → Server → DataSubscriptions
- **Media Flow**: MediaPublication → Media Channels → Server → MediaSubscriptions
- **Control Flow**: Control Channel for signaling and state management
- **Asynchronous Operations**: PromiseQueue ensures reliable operation sequencing across all components

## Client Exports

```typescript
// Main client class with static factory method
export { Client }

// Publication and subscription classes
export { DataPublication, DataSubscription, MediaPublication, MediaSubscription }

// Type definitions
export type { RemotePublication, RemoteMember, ClientConfig }
```

## Commands

```bash
# Type checking
npm run -w packages/client type

# Linting
npm run -w packages/client lint

# Run client integration tests
npm run -w packages/client test
npm run -w packages/client test:watch

# Run from package directory
cd packages/client
npm run type
npm run lint
npm run test
npm run test:watch
```

## Development Guidelines

### Design Principles

1. **Modular Architecture**: Separated concerns with ConnectionManager, Publisher, and Subscriber classes
2. **Transport-Agnostic Design**: Client logic independent of specific WebRTC implementation
3. **Dependency Injection**: Supports both browser-native and werift RTCPeerConnection
4. **Event-Driven Architecture**: Uses werift's event system for communication
5. **Asynchronous Reliability**: PromiseQueue integration ensures proper operation sequencing
6. **Type Safety**: Full TypeScript with strict type checking

### Implementation Patterns

**Client Initialization**:
```typescript
// Static factory method (recommended)
const client = await Client.create(offer, memberId, {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  peerConnection: customPeerConnection  // For testing
});

// Manual initialization (internal use)
const client = new Client(config);
await client.init(offer, memberId);
```

**Event Handling Best Practices**:
```typescript
// Connection events
await client.onPublicationReady.asPromise(10000);

// Publication events
client.onPublicationReady.subscribe((publication) => {
  console.log('New publication:', publication.id);
});

// Media events
client.onMediaPublicationReady.subscribe((publication) => {
  console.log('New media publication:', publication.id, publication.type);
});

// Member events
client.onMemberJoined.subscribe(({ memberId, name, metadata }) => {
  console.log('Member joined:', name || memberId);
});

client.onMemberLeft.subscribe((memberId) => {
  console.log('Member left:', memberId);
});
```

**Error Handling**:
- Comprehensive error handling for WebRTC operations
- Connection state management with automatic recovery
- Graceful degradation for network issues

### Testing Integration

**Integration Tests** (`tests/`):
- Comprehensive API coverage testing
- Basic connection functionality validation
- Data and media channel operation testing
- Event system verification
- Client lifecycle management

**Test Configuration**:
- Uses Vitest with Node.js environment
- Werift dependency injection for pure Node.js testing
- Timeout: 10000ms (10 seconds)

**Test Structure**:
- `client-configuration.test.ts` - Configuration and initialization
- `client-lifecycle.test.ts` - Connection lifecycle management
- `connection.test.ts` - Basic connection functionality
- `data-publication.test.ts` - Data channel operations
- `data-fragmentation.test.ts` - Data fragmentation for large messages
- `fragmentation.test.ts` - Message fragmentation and reassembly
- `media-publication.test.ts` - Media channel operations
- `member-events.test.ts` - Event handling
- `member-metadata.test.ts` - Metadata management
- `multi-media-publication.test.ts` - Multiple concurrent media stream scenarios

### WebRTC Implementation Details

**PeerConnection Management**:
- Single PeerConnection per client instance
- Support for both browser-native and werift implementations
- ICE candidate handling with trickle ICE support
- Connection state monitoring and recovery

**DataChannel Handling**:
- Control channel for signaling (label: `sfu`)
- Publication channels (label: `pub_${publicationId}`)
- Subscription channels (label: `sub_${publicationId}`)
- Message compression and fragmentation support

**Media Stream Management**:
- MediaStreamTrack handling for audio/video
- Transceiver management for media publications
- Stream subscription with track management
- Support for multiple media publications

### Integration Points

**With Core Package**:
- Member state synchronization
- Publication/subscription lifecycle
- Event propagation and handling

**With Reference Server**:
- WebRTC signaling (offer/answer exchange)
- ICE candidate exchange via REST API
- Room joining and member management

**With JSON-RPC Package**:
- DataChannel transport for structured communication
- Method call abstraction over WebRTC
- Type-safe request/response handling

### Browser Compatibility

**Supported Environments**:
- Modern browsers with WebRTC support
- Node.js environment with werift

**WebRTC APIs Used**:
- `RTCPeerConnection` for peer connections
- `RTCDataChannel` for data communication
- `MediaStreamTrack` for audio/video streams
- `RTCRtpTransceiver` for media management