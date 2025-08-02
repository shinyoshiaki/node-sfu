# CLAUDE.md - Utils Package

This file provides guidance to Claude Code when working with the shared utilities package of node-sfu.

@../../../CLAUDE.md

## Package Overview

The `packages/utils/` directory contains shared utility functions and classes that are used across both the client and core packages. This package ensures code consistency and eliminates duplication between client-side and server-side implementations.

## Browser and Node.js Compatibility Requirement

**CRITICAL CONSTRAINT**: This package MUST contain only code that runs in both Node.js and browser environments. Do not place any environment-specific code in this package.

**Forbidden Code Patterns**:
- Node.js-only APIs (fs, path, process, etc.)
- Browser-only APIs (DOM, window, document, etc.)
- Platform-specific implementations
- Environment-dependent imports

**Allowed Code Patterns**:
- Pure JavaScript/TypeScript functions
- Web APIs available in both environments (TextEncoder, TextDecoder, crypto, etc.)
- Third-party libraries compatible with both environments
- Data structures and algorithms
- Utility functions for data transformation

## Architecture

### Current Utilities

**FragmentationManager** (`src/fragmentation.ts`):
- Handles data fragmentation for DataChannel communication
- Supports both string and ArrayBuffer data types
- Uses CBOR encoding for structured fragment data with cbor2 library
- Implements fragment reassembly with cluster management
- Provides 300-byte fragmentation threshold (reduced for reliability)
- Compatible with both browser and Node.js environments
- Static methods for fragmenting and instance methods for reassembly

### Key Features

**Data Fragmentation**:
- Automatic fragmentation for messages exceeding 300-byte threshold
- Unique message ID assignment using crypto.randomUUID()
- Fragment indexing with isClusterStart/isClusterEnd markers
- Support for both string and ArrayBuffer data types
- Type preservation with "s" (string) and "b" (binary) indicators

**Fragment Reassembly**:
- Out-of-order fragment handling
- Duplicate fragment detection and filtering
- Cluster completion validation
- Automatic cleanup after reassembly

**Cross-Platform Compatibility**:
- Uses only Web API standards (TextEncoder, crypto.randomUUID)
- CBOR encoding via cbor2 library (compatible with both environments)
- No environment-specific dependencies
- ArrayBuffer and Uint8Array for universal data handling

## Core Exports

```typescript
// Fragmentation utilities (exported from src/fragmentation.ts)
export { FragmentationManager, Fragment, FragmentCluster, FRAGMENT_SIZE_THRESHOLD }
```

## Commands

```bash
# Build the package
npm run -w packages/utils build

# Type checking
npm run -w packages/utils type

# Run from package directory
cd packages/utils
npm run build
npm run type
```

## Development Guidelines

### Design Principles

1. **Universal Compatibility**: All code must work in both browser and Node.js
2. **No Environment Dependencies**: Avoid platform-specific APIs
3. **Web Standards Only**: Use only standardized Web APIs
4. **Type Safety**: Full TypeScript with strict mode
5. **Minimal Dependencies**: Keep external dependencies minimal and cross-platform

### Implementation Patterns

**Data Processing**:
- Use Web API standards (TextEncoder/TextDecoder for text handling)
- Leverage ArrayBuffer and Uint8Array for binary data
- Employ crypto.randomUUID() for unique identifier generation

**Error Handling**:
- Comprehensive error handling for data processing
- Graceful degradation for malformed data
- Console logging for debugging (available in both environments)

**Memory Management**:
- Proper cleanup of data structures
- Avoid memory leaks in long-running processes
- Efficient buffer management

### Cross-Platform Testing

**Environment Validation**:
- Test in both Node.js and browser environments
- Verify compatibility with different JavaScript engines
- Ensure consistent behavior across platforms

**Dependencies**:
- Only use libraries that explicitly support both environments
- Verify library compatibility before adding dependencies
- Document any environment-specific behavior

## Integration Points

**With Core Package**:
- Server-side fragmentation for DataChannel communication
- Member-to-member data routing with fragmentation
- Large message handling in room management

**With Client Package**:
- Browser-side fragmentation for peer communication
- WebRTC DataChannel message processing
- Real-time data transmission optimization

## Key Implementation Details

**Fragmentation Process**:
1. Data size evaluation against 300-byte threshold
2. Message ID generation using crypto.randomUUID()
3. Sequential fragmentation with Fragment metadata
4. CBOR encoding using cbor2 for structured transmission
5. Static method pattern for simple fragmentation

**Reassembly Process**:
1. Fragment validation and CBOR decoding
2. Cluster state management with Fragment maps
3. isClusterStart/isClusterEnd verification
4. Data reconstruction with type preservation
5. Automatic cleanup after reassembly

**Type Safety**:
- Proper TypeScript interfaces for Fragment and FragmentCluster
- Support for both string and ArrayBuffer data types
- Type indicators preserved through fragmentation/reassembly
- Comprehensive type validation for fragment processing