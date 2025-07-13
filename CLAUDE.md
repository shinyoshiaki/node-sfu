# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **node-sfu**, a Pure Node.js WebRTC SFU (Selective Forwarding Unit) written in TypeScript. The project uses the werift WebRTC library (included as a git submodule) to implement WebRTC protocols with a room-based architecture for managing multi-party WebRTC sessions.

**Requirements**: Node.js 18 or higher, ES modules (`"type": "module"`)

**Dependencies**: Uses werift WebRTC library via git submodule

## Architecture

### Workspace Structure
- `packages/core/` - Core SFU logic with Room, Member, DataPublication, DataSubscription, and MediaPublication management
- `packages/client/` - Client-side WebRTC implementation with publication and subscription support for both data and media channels  
- `packages/reference-server/` - Express.js server with room management and WebRTC signaling endpoints
- `packages/e2e/` - End-to-end testing infrastructure with browser-based tests using Vitest
- `packages/conference/` - React-based conference application with WebRTC video conferencing UI using Tailwind CSS and Valtio (state management library)
- `submodules/werift/` - WebRTC protocol implementation in TypeScript

### Key Components

1. **Room** (packages/core/src/room.ts): Manages WebRTC sessions for multiple participants
2. **Member** (packages/core/src/member.ts): Represents individual participants with publication/subscription management
3. **Client** (packages/client/src/index.ts): Browser-side WebRTC client with ICE handling (supports both browser-native and werift RTCPeerConnection)
4. **DataPublication/DataSubscription**: Manages data channel publications and subscriptions
5. **MediaPublication/MediaSubscription**: Manages media channel publications and subscriptions for audio/video streams
6. **Reference Server** (packages/reference-server/src/main.ts): Express server with room management APIs

#### Manager Classes (Core Package)
- **PeerConnectionManager**: Manages peer connection lifecycle
- **ControlChannelHandler**: Handles control channel messages
- **DataChannelManager**: Manages data channel operations  
- **MediaManager**: Manages media streams and subscriptions

#### Manager Classes (Client Package)
- **ControlChannelManager**: Client-side control channel handling with connection state tracking
- **MediaManager**: Client-side media management

#### Utility Features
- **Message Compression**: Automatic gzip compression for control channel messages
- **Message Fragmentation**: Handles large messages (>512B threshold) with automatic fragmentation and reassembly
  - Fragment size threshold: 512 bytes
  - Maximum fragment size: 400 bytes (conservative size accounting for metadata)
  - Automatic message ID generation for fragment tracking
- **MessageAssembler**: Fragment reassembly with timeout management (30 seconds)
- **Enhanced Error Handling**: Comprehensive error handling for fragmented messages
- **Member Disconnect Detection**: Automatic detection and cleanup of disconnected members
  - Dual detection: PeerConnection state monitoring + Control channel monitoring
  - Automatic resource cleanup: Publications, subscriptions, and peer connections
  - Real-time notifications: Remaining members notified via `onMemberLeft` event
  - Graceful handling of both explicit leave operations and unexpected connection failures

### Core Exports & API Endpoints

**Core Package Exports:**
- `createRoom()`, `findRoom(roomId)`, `Room`, `Member`, `DataPublication`, `DataSubscription`, `MediaPublication`, `MediaSubscription`

**API Endpoints:**
- `POST /rooms` - Create room
- `POST /rooms/:roomId/join` - Join room and receive offer SDP
- `POST /members/:memberId/answer` - Send answer SDP
- `POST /members/:memberId/ice-candidate` - Add ICE candidate after offer/answer exchange
- `POST /members/:memberId/leave` - Leave room
- `GET /health` - Health check

**Default Port:** 4001 (previously 4000)

## Commands

```bash
# Initialize git submodules (required for werift dependency)
npm run submodule

# Type checking across all workspaces
npm run type

# Linting with Biome
npm run lint

# Start reference server for development (default port: 4001)
npm run server

# Start conference application
npm run conference

# Run all tests (E2E and unit tests)
npm run test-all
npm run test

# Run specific package scripts
npm run -w packages/core type
npm run -w packages/client type
npm run -w packages/reference-server type
npm run -w packages/e2e type

# Run E2E tests (browser-based)
npm run e2e
# Or directly: npm run -w packages/e2e test:e2e

# Run E2E tests in watch mode  
npm run -w packages/e2e test:watch

# Run individual test files
npm run -w packages/e2e test -- audio-publish.test.ts

# Run client tests (integration tests with werift)
npm run -w packages/client test
npm run -w packages/client test:watch

# Run conference E2E tests (Playwright)
npm run -w packages/conference test:e2e
npm run -w packages/conference test:e2e:dev  # Dev mode with UI
npm run -w packages/conference test:e2e:ui   # UI mode

# Package management
npm run upgrade-interactive  # Interactive dependency updates
npm run clean               # Clean all node_modules directories
```

## Development Guidelines

### Core Principles

1. **Event-Driven Architecture**: Uses werift's custom event system (submodules/werift/packages/common/src/event.ts)
2. **Single PeerConnection per Member**: One PC + one control DataChannel per member
3. **Publish-Subscribe Pattern**: DataPublication/DataSubscription and MediaPublication for flexible channel management
4. **Type Safety**: Full TypeScript (ES2022, strict mode) across all packages
5. **Modular Design**: Separate client and server-side implementations

### Channel Labeling Convention
- Control channels: `sfu`
- Publication channels: `pub_${publicationId}`
- Subscription channels: `sub_${publicationId}`

### Code Standards
- **TypeScript**: ES2022 target with strict mode enabled
- **Code Style**: Enforced by Biome (`npm run lint` before committing)
- **WebRTC Stack**: Uses werift via git submodule (see `submodules/werift/CLAUDE.md`)
- **Package Placement**:
  - Core SFU logic, room management → `packages/core`
  - Client-side WebRTC code → `packages/client`
  - Server implementation and APIs → `packages/reference-server`
  - Testing infrastructure → `packages/e2e`
  - Conference application → `packages/conference`

### WebRTC Implementation

**Key Classes:**
- `RTCPeerConnection`: Standard WebRTC peer connection (also supports injection of werift implementation)
- `RTCDataChannel`: For data communication with compression and fragmentation support
- `MediaStreamTrack`: For audio/video streams
- `DataPublication/DataSubscription`: Higher-level data channel abstractions
- `MediaPublication/MediaSubscription`: Higher-level media stream abstractions with transceiver support
- `MessageAssembler`: Fragment reassembly with automatic timeout handling

**Client Configuration:**
- Client constructor accepts optional configuration:
  - `peerConnection`: Custom RTCPeerConnection for dependency injection
  - `iceServers`: Custom ICE server configuration
- Supports both browser-native and werift RTCPeerConnection implementations
- Enables integration testing with pure Node.js WebRTC stack
- Enhanced connection stability with improved ICE candidate handling

**Communication Patterns:**
- **Data**: Control Channel → DataPublication → Room → DataSubscriptions (with compression and fragmentation)
- **Media**: MediaPublication → Stream Management → MediaSubscription (with transceiver control)
- **Control Channel**: Enhanced connection state tracking with `onConnected` event
- **ICE Handling**: Support for trickle ICE via dedicated API endpoint
- **Message Processing**: Automatic compression, fragmentation, and reassembly for large payloads
- **Disconnect Handling**: Automatic detection via `onDisconnected` → Room cleanup → `onMemberLeft` notifications

**Architecture Notes:**
- Room-based SFU with P2P WebRTC connections between members
- Unique room IDs (UUID) and member tracking
- Werift submodule must be initialized (`npm run submodule`)

### Implementation Checklist
1. Check existing patterns in `packages/core`
2. Follow event-driven architecture using werift's Event system
3. Maintain transport-agnostic design
4. Ensure type safety throughout
5. Use established channel labeling conventions
6. Implement both server-side (core) and client-side components
7. Consider both data and media scenarios
8. Add corresponding E2E tests

## Testing Architecture

### Testing Framework Distribution

**Framework Usage by Package:**
- **packages/client**: Vitest (Node.js environment) - Client API comprehensive testing
- **packages/e2e**: Vitest browser mode - Cross-client communication scenarios
- **packages/conference**: Playwright - Conference application functionality
- **packages/core**: No direct tests (covered by integration/E2E)
- **packages/reference-server**: No direct tests (covered by integration/E2E)

### Test Types and Coverage

#### **1. Client API Integration Tests** (`packages/client/test/`)

**Framework**: Vitest (Node.js environment)
**Location**: `packages/client/test/integration.test.ts`
**Purpose**: Comprehensive testing of Client API to ensure all client methods function correctly

**Test Focus:**
- **Complete Client API coverage**: All public methods and properties
- **Basic connection functionality**: Connection establishment and lifecycle
- **Data channel operations**: Publication, subscription, and message handling
- **Media channel operations**: Media publication, subscription, and stream management
- **Event system verification**: All client events and event handlers

**Test Structure:**
- Basic connection and client state tests
- Data channel API comprehensive testing
- Media channel API comprehensive testing
- Client lifecycle management tests
- Control channel and event tests

**Key Features:**
- Pure Node.js WebRTC stack testing via werift dependency injection
- Single-client focused testing for API validation
- Core-Client integration validation
- Connection state and lifecycle management verification

**Configuration** (`packages/client/test/vitest.config.ts`):
- Environment: Node.js
- Timeout: 10000ms (10 seconds)
- Globals: true

#### **2. Cross-Client Communication E2E Tests** (`packages/e2e/tests/`)

**REQUIRED FRAMEWORK**: Vitest browser mode ONLY
**STRICTLY FORBIDDEN**: `@playwright/test` or direct playwright usage

**Purpose**: Testing client-to-client communication scenarios through SFU relay

**Current Test Suite:**
- `audio-publish.test.ts` - Audio publishing functionality
- `datachannel-pubsub.test.ts` - Data channel publish-subscribe communication (consolidated from separate publish/subscribe tests)
- `member-disconnect.test.ts` - Member disconnect detection and cleanup scenarios

**Test Focus:**
- **Cross-client data communication**: Publisher-subscriber data flow validation
- **Cross-client media communication**: Media streaming between participants
- **SFU relay functionality**: Selective forwarding and message delivery
- **Publication-subscription workflows**: Complete pubsub lifecycle testing
- **Member lifecycle management**: Disconnect detection, cleanup, and notification testing
- **Real browser WebRTC**: Authentic WebRTC protocol behavior

**Test Infrastructure:**
- **Custom Test Runner**: `run-tests.mjs` (built with zx library)
- **Server Management**: Automatic reference server lifecycle
- **Dynamic Ports**: `werift.randomPort()` for conflict prevention
- **Health Checks**: Server verification before tests
- **Automatic Cleanup**: Post-test resource cleanup

**Configuration** (`packages/e2e/vitest.config.ts`):
- Browser: Chromium with WebRTC flags
- Headless: true
- Timeout: 60000ms (60 seconds)
- Retry: 1
- Chrome flags: `--use-fake-ui-for-media-stream`, `--use-fake-device-for-media-stream`

**Test Utilities** (`packages/e2e/tests/fixture.ts`):
- Server URL configuration from environment
- `setupTrickleIce()` utility for ICE candidate handling
- Dynamic port detection via `VITE_TEST_SERVER_PORT`

#### **3. Conference Application E2E Tests** (`packages/conference/e2e/tests/`)

**FRAMEWORK**: Playwright ONLY (exception for conference package)
**ALLOWED**: `@playwright/test` usage for `packages/conference` E2E tests

**Purpose**: Testing conference application's core functionality and user workflows

**Current Test Suite:**
- `conference.test.ts` - Conference room creation, joining, and video streaming (consolidated from separate video publish/relay tests)

**Test Focus:**
- **Room entry workflows**: Creating and joining conference rooms
- **Media streaming in UI**: Video publishing and receiving through conference interface
- **Multi-participant scenarios**: Multiple users in the same conference
- **Conference lifecycle**: Room creation, participant joining/leaving
- **UI-level media handling**: Video display and stream management in React components
- **End-to-end conference workflows**: Complete user experience testing

**Test Infrastructure:**
- **Custom Test Runner**: `run-tests.js` (Playwright wrapper)
- **Dual Server Setup**: Vite dev server + Reference server
- **Dynamic Port Assignment**: Environment variable management
- **Page Object Model**: `ConferencePageObject` class

**Configuration** (`packages/conference/playwright.config.ts`):
- Browsers: Chromium
- Timeout: 60000ms
- Retry: 1-2 (CI dependent)
- WebServer: Dual server configuration

**Test Utilities** (`packages/conference/e2e/fixture.ts`):
- `ConferencePageObject` class for page interactions
- Browser console/error capture
- WebRTC-specific wait conditions
- Video stream verification utilities

### Test Execution Commands

**Root-level Commands:**
```bash
# Run all E2E tests across workspaces
npm run e2e

# Run all tests across workspaces
npm run test

# Sequential execution of e2e and test
npm run test-all
```

**Package-specific Commands:**
```bash
# Client integration tests
npm run -w packages/client test
npm run -w packages/client test:watch

# Core E2E tests
npm run -w packages/e2e test:e2e     # Custom runner
npm run -w packages/e2e test:watch   # Vitest watch mode

# Conference E2E tests
npm run -w packages/conference test:e2e       # Standard mode
npm run -w packages/conference test:e2e:dev   # Development with UI
npm run -w packages/conference test:e2e:ui    # UI mode
```

### Testing Patterns and Best Practices

#### **Event-Driven Testing**
- Use `await client.onConnected.asPromise(10000)` instead of manual Promise with setTimeout
- Use `watch()` for conditional events: `await client.onPublicationReady.watch((id) => id === publicationId, timeout)`
- Control channel connection is automatically detected and `onConnected` event fired
- MediaSubscription `setTrack` now requires both track and transceiver parameters
- Member disconnect events: `await client.onMemberLeft.watch((memberId) => memberId === expectedId, timeout)`
- Server-side disconnect detection: `member.onDisconnected.subscribe((memberId) => { /* cleanup */ })`
- Provides cleaner code, automatic cleanup, and built-in timeout handling

#### **WebRTC-Specific Testing**
- **Real Browser Environment**: Mandatory for WebRTC APIs
- **Real Media Devices**: Consistent testing with real media streams
- **ICE Candidate Handling**: Trickle ICE simulation
- **Connection State Management**: Comprehensive state verification
- **Do not mock**: MediaStreamTrack or core WebRTC components

#### **Server Integration**
- **Dynamic Port Assignment**: Prevents test conflicts
- **Server Lifecycle Management**: Automatic startup/shutdown
- **Health Check Verification**: Ensures server readiness
- **Environment Isolation**: Clean test environments

### Testing Dependencies

**Core Testing Libraries:**
- `vitest`: ^3.2.1 - Primary testing framework
- `@vitest/browser`: ^3.0.5 - Browser environment support
- `playwright`: 1.53.1 - Browser automation
- `@playwright/test`: 1.53.1 - Playwright testing framework

**Test Utilities:**
- `zx`: ^8.1.8 - Shell scripting for test runners

### Testing Requirements

**Before Implementation Completion:**
1. Always run E2E tests before completing implementation
2. Add E2E test cases for new features
3. Follow existing patterns in respective test directories
4. Verify all tests pass with `npm run test-all`

**Framework Restrictions:**
- **E2E Package**: MUST use Vitest browser mode only
- **Conference Package**: EXCEPTION - Uses Playwright for React testing
- **Integration Tests**: Node.js environment with werift dependency injection

**Test Consolidation Notes:**
- E2E tests have been streamlined and consolidated to reduce complexity
- Separate publish/subscribe tests merged into comprehensive pubsub tests
- Focus on core scenarios rather than exhaustive individual test coverage

**WebRTC Testing Requirements:**
- Browser environment mandatory for WebRTC APIs
- Fake media devices for consistent testing
- ICE candidate handling simulation
- Connection state management verification
