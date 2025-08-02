# CLAUDE.md - Conference Package

This file provides guidance to Claude Code when working with the conference application of node-sfu.

@../../../CLAUDE.md

## Package Overview

The `packages/conference/` directory contains a React-based conference application that demonstrates the node-sfu WebRTC capabilities. This is a complete video conferencing web application built with modern React patterns, Tailwind CSS, and comprehensive screen sharing functionality.

## Architecture

### Technology Stack

**Frontend Framework**:
- React 18 with TypeScript
- Vite build system and dev server
- Tailwind CSS for styling
- Valtio for state management

**WebRTC Integration**:
- node-sfu client package for WebRTC communication
- Real-time video conferencing capabilities
- Comprehensive screen sharing with debug mode support
- Media stream management for camera, audio, and screen sharing
- Room-based participant management with multi-stream support

### Core Components

**HomePage** (`src/components/pages/HomePage.tsx`):
- Landing page for conference application
- Room creation and joining interface
- User interface for entering conference rooms

**ConferencePage** (`src/components/pages/ConferencePage.tsx`):
- Main conference interface with video streams
- Participant management and video display
- Real-time communication controls
- Room state management

**Conference UI Components**:
- `ControlBar.tsx` - Media controls and screen sharing buttons
- `Header.tsx` - Conference room header and info
- `LocalVideoPanel.tsx` - Local video stream display
- `RemoteVideoGrid.tsx` - Grid layout for remote participants
- `layout/ConferenceLayout.tsx` - Main conference layout structure
- `modes/ConferenceMode.tsx` - Standard conference mode component
- `modes/ScreenShareMode.tsx` - Screen sharing mode component
- `video/ParticipantVideo.tsx` - Individual participant video component
- `video/VideoGrid.tsx` - Video grid layout component
- `video/VideoPlayer.tsx` - Base video player component
- `video/ScreenShareView.tsx` - Screen sharing display component
- `video/ParticipantsSidebar.tsx` - Participants sidebar component

**Chat Components**:
- `chat/ChatPanel.tsx` - Chat panel component
- `chat/ChatInput.tsx` - Chat input component
- `stores/chatStore.ts` - Chat state management with Valtio
- `types/chat.ts` - Chat type definitions

**WebRTC Hook** (`src/useVideoWebRTC.ts`):
- Custom React hook for WebRTC functionality
- Manages client connection and media streams including screen sharing
- Handles participant events and state updates
- Abstracts WebRTC complexity from components
- Supports metadata-based stream identification

**Screen Sharing Hook** (`src/hooks/useScreenShare.ts`):
- Dedicated React hook for screen sharing functionality
- Debug mode support using camera as mock screen share
- Real screen sharing via getDisplayMedia API
- Automatic stream cleanup when sharing ends
- Screen sharing state management and UI indicators

### Application Flow

1. **Room Entry**: User creates or joins room via HomePage
2. **Conference**: User enters ConferencePage with video streaming
3. **Media Management**: Automatic camera/microphone access and publishing
4. **Screen Sharing**: Toggle screen sharing with UI controls and indicators
5. **Text Chat**: Real-time text chat functionality with message history
6. **Participant Management**: Real-time participant join/leave handling
7. **Video Display**: Multi-participant video grid with screen sharing support
8. **Debug Mode**: Development-friendly screen sharing using camera feed

## Development Configuration

**Default Ports**:
- Conference App: 3001 (Vite dev server)
- Reference Server: 4001 (backend API)

**Build Configuration**:
- Vite configuration in `vite.config.ts`
- TypeScript configuration in `tsconfig.json` and `tsconfig.node.json`
- Tailwind configuration in `tailwind.config.js`
- PostCSS configuration in `postcss.config.js`

## Commands

```bash
# Start conference application
npm run conference

# Type checking
npm run -w packages/conference type

# Linting
npm run -w packages/conference lint

# Run conference E2E tests
npm run -w packages/conference test:large
npm run -w packages/conference test:large:dev  # Development with UI
npm run -w packages/conference test:large:ui   # UI mode

# Run from package directory
cd packages/conference
npm run dev         # Start development server (port 3001)
npm run build       # Build for production
npm run preview     # Preview production build
npm run type        # Type checking
npm run lint        # Linting with Biome
npm run test:large  # Run E2E tests
```

## Development Guidelines

### Design Principles

1. **Component-Based Architecture**: Modular React components with clear responsibilities
2. **State Management**: Valtio for reactive state management
3. **WebRTC Abstraction**: Custom hooks abstract WebRTC complexity
4. **Responsive Design**: Tailwind CSS for mobile-first responsive design
5. **Screen Sharing Integration**: Seamless screen sharing with UI controls
6. **Type Safety**: Full TypeScript integration

### Implementation Patterns

**WebRTC Integration**:
```typescript
// Custom hook usage
const { client, participants, localStream } = useVideoWebRTC(roomId);

// Screen sharing hook usage
const { 
  isScreenSharing, 
  isDebugMode, 
  startScreenShare, 
  stopScreenShare 
} = useScreenShare(client);

// Component integration
useEffect(() => {
  if (client) {
    // Handle client events
    client.onMemberJoined.subscribe(handleMemberJoined);
  }
}, [client]);
```

**State Management with Valtio**:
```typescript
// Reactive state
const conferenceState = proxy({
  participants: new Map(),
  localStream: null,
  connected: false
});

// Component usage
const snapshot = useSnapshot(conferenceState);
```

**Component Structure**:
- Functional components with hooks
- TypeScript interfaces for props
- Tailwind CSS for styling
- Event-driven updates from WebRTC

### Testing Framework

**E2E Testing** (`e2e/tests/`):
- **Framework**: Playwright (EXCEPTION - allowed for conference package)
- **Test Suites**:
  - `participant-management.test.ts` - Participant join/leave workflows
  - `screen-sharing.test.ts` - Screen sharing functionality testing
  - `text-chat.test.ts` - Real-time chat functionality testing
  - `video-streaming.test.ts` - Video streaming and media controls
  - `media-controls.test.ts` - Media control interface testing
- **Supporting Files**: `fixture.ts` for test utilities and page objects

**Test Focus Areas**:
- Room creation and joining workflows
- Video publishing and streaming through UI
- Screen sharing functionality in debug and real modes
- Real-time text chat with message history
- Participant management with UI interactions
- Media controls (mute/unmute, camera on/off, screen share toggle)
- Multi-participant scenarios with concurrent media streams
- Conference lifecycle management
- UI-level media handling and screen sharing controls
- End-to-end user experience validation

**Test Infrastructure**:
- Dual server setup: Vite dev server + Reference server
- Dynamic port assignment for test isolation
- Browser console/error capture for debugging
- WebRTC-specific wait conditions and stream verification

### UI/UX Patterns

**Video Grid Layout**:
- Responsive grid for multiple participants with screen sharing display
- Automatic layout adjustment based on participant count and shared screens
- Local/remote stream differentiation with screen sharing indicators
- Video controls, participant labels, and screen sharing controls
- Screen sharing prominence in UI layout

**User Experience**:
- Automatic camera/microphone access
- One-click screen sharing with visual feedback
- Real-time participant notifications
- Connection status indicators
- Error handling with user feedback
- Debug mode for development-friendly screen sharing testing

### Integration Points

**With Client Package**:
- Client instance management through custom hooks
- Publication/subscription handling for media streams
- Event handling for participant management
- Connection state management

**With Reference Server**:
- REST API calls for room management
- WebRTC signaling through server endpoints
- Room joining and member lifecycle

**With JSON-RPC Package**:
- Structured communication protocols for future enhancements
- Type-safe API integration potential
- WebSocket transport for real-time notifications

### Build and Deployment

**Development Build**:
- Vite dev server with hot module replacement
- TypeScript type checking
- Tailwind CSS compilation
- Source maps for debugging

**Production Build**:
```bash
npm run build      # Build for production
npm run preview    # Preview production build
```

**Environment Variables**:
- `VITE_SERVER_URL` - Backend server URL configuration
- Build-time environment variable processing