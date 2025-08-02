# CLAUDE.md - Reference Server Package

This file provides guidance to Claude Code when working with the reference server implementation of node-sfu.

@../../../CLAUDE.md

## Package Overview

The `packages/reference-server/` directory contains the Express.js server implementation that provides REST API endpoints for WebRTC signaling and room management. This serves as a reference implementation demonstrating how to integrate the core SFU logic with a web server.

## Architecture

### Server Implementation

**Main Server** (`src/main.ts`):
- Express.js application with WebRTC signaling endpoints
- Room management and member lifecycle handling
- ICE candidate exchange via REST API
- Support for multiple concurrent media publications per member
- Health check endpoint for monitoring
- CORS support for cross-origin requests

### API Endpoints

**Room Management**:
- `POST /rooms` - Create new room, returns `roomId`
- `GET /health` - Health check endpoint

**WebRTC Signaling**:
- `POST /rooms/:roomId/join` - Join room with optional member metadata and receive offer SDP
- `POST /members/:memberId/answer` - Send answer SDP to complete handshake
- `POST /members/:memberId/ice-candidate` - Add ICE candidate after offer/answer exchange

**Request/Response Formats**:
```typescript
// Room creation
POST /rooms → { roomId: string }

// Join room with metadata
POST /rooms/:roomId/join
Body: { name?: string, metadata?: any }
→ { memberId: string, name?: string, metadata?: any, offer: RTCSessionDescriptionInit }

// Answer with SDP
POST /members/:memberId/answer
Body: { answer: RTCSessionDescriptionInit }
→ { success: true }

// ICE candidate
POST /members/:memberId/ice-candidate
Body: { candidate: RTCIceCandidateInit }
→ { success: true }

// Health check
GET /health → { status: 'ok' }
```

### Integration Points

**With Core Package**:
- Uses `createRoom()`, `findRoom()` from core
- Manages Room and Member instances
- Handles member join/leave operations
- Propagates events from core to HTTP responses

**With Client Package**:
- Provides signaling for client connections
- Handles WebRTC offer/answer exchange
- Manages ICE candidate trickle exchange
- Supports multiple clients per room with concurrent media streams
- Facilitates screen sharing and multi-media publication routing

**With JSON-RPC Package**:
- HTTP transport for REST-like JSON-RPC endpoints
- Structured API request/response handling
- WebSocket transport integration potential

## Server Configuration

**Default Settings**:
- Port: 4001 (development default)
- CORS: Enabled for all origins
- Content-Type: `application/json`
- Body parsing: JSON middleware enabled

**Environment Variables**:
- `PORT` - Server port (default: 4001)

## Commands

```bash
# Start development server
npm run server

# Type checking
npm run -w packages/reference-server type

# Linting
npm run -w packages/reference-server lint

# Run from package directory
cd packages/reference-server
npm run type
npm run lint
npm run dev
```

## Development Guidelines

### Design Principles

1. **Reference Implementation**: Demonstrates core integration patterns
2. **REST API Design**: Simple HTTP endpoints for WebRTC signaling
3. **Stateless Server**: Core handles all state management
4. **Error Handling**: Comprehensive HTTP error responses
5. **CORS Support**: Cross-origin resource sharing enabled

### Implementation Patterns

**Room Management Flow**:
1. Client calls `POST /rooms` → Server creates room via `createRoom()` → Returns `roomId`
2. Client calls `POST /rooms/:roomId/join` with metadata → Server calls `room.join()` → Returns member info and offer SDP
3. Client sends `POST /members/:memberId/answer` → Server calls `member.accept()` → Completes handshake
4. Client sends `POST /members/:memberId/ice-candidate` → Server calls `member.addIceCandidate()` → Exchanges ICE candidates

**Error Handling**:
```typescript
// Standard error responses
{ error: 'Room not found' }        // 404
{ error: 'Member not found' }      // 404
{ error: 'Invalid request body' }  // 400
{ error: 'Internal server error' } // 500
```

**Request Validation**:
- JSON body parsing with error handling
- Required parameter validation
- SDP format validation for offers/answers
- ICE candidate format validation

### Server Architecture

**Express Middleware Stack**:
1. CORS handling for cross-origin requests
2. JSON body parser for request processing
3. Error handling middleware for consistent responses
4. Route handlers for API endpoints

**WebRTC Integration**:
- Delegates WebRTC operations to core package
- Translates HTTP requests to core method calls
- Handles WebRTC events and state changes
- Manages member lifecycle through HTTP

### Testing Integration

**Testing Notes**:
- No direct unit tests (tested via E2E integration)
- Tested through `packages/e2e/` test suite
- Health check endpoint for test verification
- Dynamic port assignment in test environments

**Test Support Features**:
- Health check endpoint for test readiness verification
- Clean error responses for test assertion
- CORS support for browser-based tests
- JSON response format for easy parsing

### Production Considerations

**Security**:
- Input validation for all endpoints
- CORS configuration for production environments
- Rate limiting considerations (not implemented)
- Authentication/authorization (not implemented)

**Scalability**:
- Stateless server design for horizontal scaling
- Core package handles all state management
- Room isolation for multi-tenancy
- Memory cleanup on member disconnect

**Monitoring**:
- Health check endpoint for load balancer integration
- Structured error responses for logging
- Console logging for development debugging

### Deployment

**Requirements**:
- Node.js 18 or higher
- ES modules support
- Express.js and dependencies
- Core package integration

**Environment Setup**:
```bash
# Install dependencies
npm install

# Type checking
npm run type

# Start server
npm run dev  # or npm start
```
