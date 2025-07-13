# CLAUDE.md - E2E Testing Package

This file provides guidance to Claude Code when working with the E2E testing package of node-sfu.

## Package Overview

The `packages/e2e/` directory contains end-to-end tests for the node-sfu WebRTC SFU implementation. These tests verify the complete integration between client and server components using real browsers and WebRTC protocols.

## Testing Framework

**REQUIRED FRAMEWORK**: Vitest browser mode ONLY
**STRICTLY FORBIDDEN**: `@playwright/test` or direct playwright usage

## Test Structure

### Test Suites
- `room.test.ts` - Room creation and management tests
- `datachannel-broadcast.test.ts` - Data channel broadcasting tests
- `datachannel-publish.test.ts` - Data channel publication tests
- `datachannel-subscribe.test.ts` - Data channel subscription tests
- `audio-publish.test.ts` - Audio publishing tests
- `audio-subscribe.test.ts` - Audio subscription tests
- `audio-publish-subscribe.test.ts` - Audio publish-subscribe integration tests

### Supporting Files
- `fixture.ts` - Test fixtures and utilities
- `run-tests.mjs` - Custom test runner with reference server integration
- `vitest.config.ts` - Vitest configuration for browser mode
- `tsconfig.json` - TypeScript configuration

## Commands

```bash
# Run all E2E tests
npm run e2e

# Run E2E tests directly
npm run -w packages/e2e test:e2e

# Run E2E tests in watch mode
npm run -w packages/e2e test:watch

# Run individual test files
npm run -w packages/e2e test -- audio-publish.test.ts
```

## Test Guidelines

### Event Handling Best Practices
- Use `await client.onConnected.asPromise(10000)` instead of manual Promise with setTimeout
- Use `watch()` for conditional events: `await client.onPublicationReady.watch((id) => id === publicationId, timeout)`
- Provides cleaner code, automatic cleanup, and built-in timeout handling

### Testing Requirements
- Use real browsers for authentic WebRTC behavior (headless/headed modes)
- Dynamic port assignment via `SERVER_URL` from fixture for test isolation
- Do not mock MediaStreamTrack or core WebRTC components
- Always run E2E tests before completing implementation
- Add E2E test cases for new features
- Follow existing patterns in test files

### Architecture Notes
- Tests use custom test runner with reference server integration
- Supports focused testing and watch mode
- Real browser environments ensure authentic WebRTC behavior
- Dynamic server URLs prevent test interference