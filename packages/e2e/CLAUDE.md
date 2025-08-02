# CLAUDE.md - E2E Testing Package

This file provides guidance to Claude Code when working with the E2E testing package of node-sfu.

@../../../CLAUDE.md

## Package Overview

The `packages/e2e/` directory contains end-to-end tests for the node-sfu WebRTC SFU implementation. These tests verify the complete integration between client and server components using real browsers and WebRTC protocols.

## Testing Framework

**REQUIRED FRAMEWORK**: Vitest browser mode ONLY
**STRICTLY FORBIDDEN**: `@playwright/test` or direct playwright usage

## Test Structure

### Test Suites
- `datachannel-pubsub.test.ts` - Data channel publish-subscribe integration tests
- `audio-publish.test.ts` - Audio publishing functionality tests
- `media-unpublish.test.ts` - Media unpublishing functionality tests
- `data-unpublish.test.ts` - Data unpublishing functionality tests
- `member-disconnect.test.ts` - Member disconnect detection and cleanup tests
- `member-metadata.test.ts` - Member metadata and existing members functionality tests
- `multi-media-publication.test.ts` - Cross-client media publication and RTP statistics verification tests

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
npm run -w packages/e2e test:middle

# Run E2E tests in watch mode
npm run -w packages/e2e test:middle:watch

# Type checking
npm run -w packages/e2e type

# Linting
npm run -w packages/e2e lint

# Run from package directory
cd packages/e2e
npm run test:middle
npm run test:middle:watch
npm run type
npm run lint
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
- Use RTP statistics verification for media transmission validation
- Support multi-client testing scenarios for concurrent media streams

### Architecture Notes
- Tests use custom test runner with reference server integration
- Supports focused testing and watch mode
- Real browser environments ensure authentic WebRTC behavior
- Dynamic server URLs prevent test interference
- WebRTC statistics integration for media stream verification
- Cross-client testing infrastructure for multi-participant scenarios
- JSON-RPC protocol testing for structured communication validation