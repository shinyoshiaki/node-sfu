# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **node-sfu**, a Pure Node.js WebRTC SFU (Selective Forwarding Unit) 100% written in TypeScript. The project implements a complete WebRTC-based video conferencing solution with room-based architecture for managing multi-party sessions. Features include real-time video conferencing, comprehensive media publication/subscription management, and structured JSON-RPC communication protocols.

**Requirements**: 
- Node.js 18 or higher
- ES modules (`"type": "module"`)

**Core Dependencies**: 
- werift WebRTC library (via git submodule) - Pure TypeScript WebRTC implementation
- Express.js for REST API server
- React + Vite for conference application
- Vitest + Playwright for testing

## Package-Specific Guidance

Each package has its own CLAUDE.md file with detailed guidance:

- `packages/core/CLAUDE.md` - Core SFU logic and server-side implementation
- `packages/client/CLAUDE.md` - Browser-side WebRTC client implementation  
- `packages/reference-server/CLAUDE.md` - Express.js server and REST API endpoints
- `packages/e2e/CLAUDE.md` - End-to-end testing framework and guidelines
- `packages/conference/CLAUDE.md` - React conference application development
- `packages/json-rpc/CLAUDE.md` - JSON-RPC communication protocol implementation
- `packages/utils/CLAUDE.md` - Shared utilities for cross-platform compatibility

## Workspace Structure
- `packages/core/` - Core SFU logic with Room, Member, publication/subscription management
- `packages/client/` - Client-side WebRTC implementation with data and media channel support  
- `packages/reference-server/` - Express.js server with room management and signaling endpoints
- `packages/e2e/` - End-to-end testing infrastructure using Vitest browser mode
- `packages/conference/` - React-based conference application with WebRTC UI, real-time video conferencing
- `packages/json-rpc/` - JSON-RPC protocol implementation for structured communication
- `packages/utils/` - Shared utilities and helper functions for cross-platform compatibility
- `submodules/werift/` - WebRTC protocol implementation in TypeScript

### Project-Wide Architecture

**Design Principles:**
1. **Event-Driven Architecture**: Uses werift's custom event system
2. **Single PeerConnection per Member**: One PC + one control DataChannel per member
3. **Publish-Subscribe Pattern**: DataPublication/DataSubscription for flexible channel management
4. **Type Safety**: Full TypeScript (ES2022, strict mode) across all packages
5. **Modular Design**: Separate client and server-side implementations with separated concerns architecture
6. **Asynchronous Operation Management**: PromiseQueue integration for reliable WebRTC operation sequencing

**Channel Labeling Convention:**
- Control channels: `sfu`
- Publication channels: `pub_${publicationId}`
- Subscription channels: `sub_${publicationId}`

**Default Ports:** 
- Reference Server: 4001 (default development port)
- Conference App: 3001 (Vite dev server port)

## Essential Commands

```bash
# Project setup
npm run init          # Install dependencies and initialize submodules
npm run submodule     # Initialize git submodules (werift dependency)

# Development
npm run type          # Type checking across all workspaces
npm run lint          # Linting with Biome across all workspaces
npm run server        # Start reference server (port 4001)
npm run conference    # Start conference application (port 3001)

# Testing
npm run test-all      # Run all tests (test:middle, test:large, and test)
npm run test:middle   # Run E2E tests (browser-based)
npm run test:large    # Run large integration tests  
npm run test          # Run unit tests across workspaces

# Package management
npm run clean         # Clean all node_modules directories
```

For package-specific commands, see the respective CLAUDE.md files in each package directory.

## Development Guidelines

### Project-Wide Standards

**Code Quality:**
- **TypeScript**: ES2022 target with strict mode enabled across all packages
- **Code Style**: Enforced by Biome (`npm run lint` before committing)
- **Type Safety**: Full TypeScript with strict type checking
- **Testing**: E2E tests required for new features

**WebRTC Integration:**
- **WebRTC Stack**: Uses werift via git submodule (see `submodules/werift/CLAUDE.md`)
- **Werift Initialization**: Required via `npm run submodule` before development
- **Event System**: Uses werift's custom event system for all communication
- **Transport-Agnostic**: Design should be independent of specific transport implementations

### Implementation Workflow

1. **Review Package Architecture**: Check existing patterns in relevant package
2. **Follow Event-Driven Patterns**: Use werift's Event system for communication
3. **Maintain Type Safety**: Ensure full TypeScript coverage
4. **Test Integration**: Add corresponding E2E tests for new features
5. **Code Review**: Run `npm run lint` and `npm run type` before committing

For detailed implementation guidelines, refer to the specific CLAUDE.md file in each package directory.

## Testing Strategy

### Framework Distribution by Package

- **packages/client**: Vitest (Node.js) - Client API integration testing
- **packages/e2e**: Vitest browser mode - Cross-client communication scenarios  
- **packages/conference**: Playwright - Conference application E2E testing
- **packages/json-rpc**: Vitest (Node.js) - Unit testing for JSON-RPC protocol
- **packages/utils**: Not applicable - Pure utility functions (tested through usage)
- **packages/core**: No direct tests (covered by integration/E2E)
- **packages/reference-server**: No direct tests (covered by integration/E2E)

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

For detailed testing guidelines, configuration, and test patterns, see each package's CLAUDE.md file.
