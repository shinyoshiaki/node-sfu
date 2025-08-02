# CLAUDE.md - Core Package

This file provides guidance to Claude Code when working with the core SFU logic of node-sfu.

@../../../CLAUDE.md

## Package Overview

The `packages/core/` directory contains the core SFU (Selective Forwarding Unit) implementation for managing WebRTC sessions. This is the server-side logic that handles room management, member connections, and publication/subscription routing.

## Architecture

### Core Classes

**Room** (`src/room.ts`):
- Manages WebRTC sessions for multiple participants
- Handles member lifecycle (join, leave, disconnect detection)  
- Manages publications and subscriptions routing
- Provides room-level events and metadata
- Supports multiple concurrent media publications per member

**Member** (`src/member.ts`):
- Represents individual participants with integrated management:
  - PeerConnection lifecycle management
  - Control channel handling (label: `sfu`)
  - Data/media channel operations
  - Publication and subscription management for multiple media streams
- Handles automatic disconnect detection via dual monitoring:
  - PeerConnection state changes
  - Control channel connectivity
- Supports extensible metadata (name, custom properties, media types)

**Publication Classes**:
- `DataPublication` (`src/dataPublication.ts`) - Data channel publications
- `MediaPublication` (`src/mediaPublication.ts`) - Media stream publications

**Subscription Classes**:
- `DataSubscription` (`src/dataSubscription.ts`) - Data channel subscriptions  
- `MediaSubscription` (`src/mediaSubscription.ts`) - Media stream subscriptions with multi-stream support

### Key Features

**Message Processing**:
- Automatic gzip compression for control channel messages
- Message fragmentation for large payloads (>512B threshold)
- Fragment reassembly with timeout management (30 seconds)
- Enhanced error handling with MessageAssembler class
- Support for both complete and fragmented message envelopes

**Member Management**:
- Automatic disconnect detection and cleanup
- Real-time notifications via `onMemberLeft` events
- Graceful handling of connection failures
- Member metadata support with existing members API

**Channel Labeling Convention**:
- Control channels: `sfu`
- Publication channels: `pub_${publicationId}`
- Subscription channels: `sub_${publicationId}`

## Core Exports

```typescript
// Room management functions
export { createRoom, findRoom, Room }

// Member and publication/subscription classes
export { Member, DataPublication, DataSubscription, MediaPublication, MediaSubscription }
```

## Commands

```bash
# Type checking
npm run -w packages/core type

# Linting
npm run -w packages/core lint

# Run from package directory
cd packages/core
npm run type
npm run lint
```

## Development Guidelines

### Design Principles

1. **Integrated Architecture**: Management functionality embedded directly within classes rather than separate managers
2. **Event-Driven Design**: Uses werift's custom event system for all communication
3. **Single PeerConnection per Member**: One PC + one control DataChannel per member
4. **Transport-Agnostic**: Core logic independent of transport layer
5. **Type Safety**: Full TypeScript with strict mode

### Implementation Patterns

**Event System Usage**:
- All classes extend werift's Event system
- Use `.subscribe()` for event handling
- Implement `.onDisconnected`, `.onMemberLeft`, etc.

**Error Handling**:
- Comprehensive error handling for WebRTC operations
- Graceful degradation for connection failures
- Automatic cleanup on disconnect

**Resource Management**:
- Automatic cleanup of publications/subscriptions on member disconnect
- Proper disposal of PeerConnections and DataChannels
- Memory leak prevention

### Core Integration Points

**With Client Package**:
- Member state synchronization
- Publication/subscription routing
- Event propagation

**With Reference Server**:
- Room creation and management APIs
- Member join/leave operations
- ICE candidate handling

**With JSON-RPC Package**:
- Structured message formatting for control channels
- Request/response correlation for member operations
- Type-safe communication protocols

### Testing Notes

- Core logic tested through integration tests in `packages/client/` and `packages/e2e/`
- No direct unit tests (covered by E2E scenarios)
- Tested with both browser-native and werift WebRTC implementations

## Key Implementation Details

**Publication/Subscription Flow**:
1. Member creates publication → Room receives publication
2. Room notifies other members → Members create subscriptions
3. Data/media flows through Room routing

**Disconnect Detection**:
1. PeerConnection state monitoring (`connectionState` changes)
2. Control channel monitoring (DataChannel state)
3. Automatic cleanup triggers `onMemberLeft` events

**Message Fragmentation**:
- Large messages automatically fragmented
- Maximum fragment size: 400 bytes for safe transmission
- MessageAssembler class for fragment reassembly
- Timeout handling for incomplete fragments (30 seconds)