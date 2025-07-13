# @node-sfu/client

WebRTC client library for node-sfu - a pure Node.js WebRTC SFU (Selective Forwarding Unit).

## Overview

This package provides a WebRTC client implementation that can connect to a node-sfu server, publish media streams and data channels, and subscribe to other participants' publications. It supports both browser-native WebRTC and the werift WebRTC implementation through dependency injection.

## Features

- **Flexible WebRTC Support**: Works with both browser-native and werift RTCPeerConnection implementations
- **Data Channels**: Publish and subscribe to data channels for real-time messaging
- **Media Streams**: Publish and subscribe to audio/video streams
- **Event-Driven Architecture**: Built on a robust event system for reactive programming
- **TypeScript First**: Full TypeScript support with strict typing
- **Modular Design**: Clean separation between control, data, and media management

## Basic Usage

### Creating a Client

```javascript
import { Client } from '@node-sfu/client';

// Using default browser WebRTC
const client = new Client();

// Or with custom ICE servers
const client = new Client({
  iceServers: [
    { urls: 'stun:stun.example.com:3478' },
    { urls: 'turn:turn.example.com:3478', username: 'user', credential: 'pass' }
  ]
});

// Or with werift RTCPeerConnection for Node.js environments
import { RTCPeerConnection } from '../../../submodules/werift/packages/webrtc/src/index.js';
const client = new Client({
  peerConnection: new RTCPeerConnection({ iceServers })
});
```

### Connecting to Server

```javascript
// 1. Get offer from server (via your signaling mechanism)
const offer = await fetch('/rooms/room123/join', { method: 'POST' }).then(r => r.json());

// 2. Set remote offer
await client.setRemoteOffer(offer);

// 3. Create and send answer
const answer = await client.createAndSetAnswer();
await fetch('/members/member123/answer', {
  method: 'POST',
  body: JSON.stringify(answer)
});

// 4. Wait for connection
await client.onConnected.asPromise(10000); // 10 second timeout
```

### Publishing Data

```javascript
// Create a data publication
const publication = client.publish();

// Wait for the publication to be ready
await client.onPublicationReady.watch(
  (id) => id === publication.id,
  5000 // timeout
);

// Send messages
publication.send('Hello, world!');
publication.send(JSON.stringify({ type: 'chat', message: 'Hi!' }));
```

### Subscribing to Data

```javascript
// Subscribe to a publication
client.subscribe('publication-id-from-server');

// Listen for messages
client.onDataChannelMessage.add((message) => {
  console.log('Received:', message);
});
```

### Publishing Media

```javascript
// Get user media
const stream = await navigator.mediaDevices.getUserMedia({
  audio: true,
  video: true
});

// Publish each track
for (const track of stream.getTracks()) {
  const publication = await client.publishMedia(track);
  console.log('Published track:', publication.id);
}
```

### Subscribing to Media

```javascript
// Subscribe to a media publication
const subscription = await client.subscribeMedia('media-publication-id');

// Access the track
const track = subscription.track;
if (track) {
  // Attach to video element
  const video = document.createElement('video');
  video.srcObject = new MediaStream([track]);
  video.play();
}
```

## API Reference

### Client

#### Constructor

```typescript
new Client(config?: ClientConfig)
```

**ClientConfig:**
- `peerConnection?: any`: Optional custom RTCPeerConnection instance (supports both browser-native and werift implementations)
- `iceServers?: RTCIceServer[]`: Optional array of ICE servers (default: `[{ urls: "stun:stun.l.google.com:19302" }]`)

#### Connection Methods

- `setRemoteOffer(offer: RTCSessionDescriptionInit): Promise<void>`
- `createAndSetAnswer(): Promise<RTCSessionDescriptionInit>`
- `isConnected(): boolean`
- `close(): void`

#### Data Channel Methods

- `publish(): Promise<DataPublication>` - Create a new data publication
- `subscribe(publicationId: string): void` - Subscribe to a data publication
- `getPublication(publicationId: string): DataPublication | undefined`
- `getPublications(): DataPublication[]`
- `getSubscription(publicationId: string): DataSubscription | undefined`
- `getSubscriptions(): DataSubscription[]`

#### Media Methods

- `publishMedia(track: MediaStreamTrack | MediaStreamTrackLike): Promise<MediaPublication>`
- `subscribeMedia(publicationId: string): Promise<MediaSubscription>`
- `getMediaPublication(publicationId: string): MediaPublication | undefined`
- `getMediaPublications(): MediaPublication[]`
- `getMediaSubscription(subscriptionId: string): MediaSubscription | undefined`
- `getMediaSubscriptions(): MediaSubscription[]`

#### Events

- `onConnected: Event<[]>` - Fired when control channel is connected
- `onControlMessage: Event<[string]>` - Control channel messages
- `onPublicationReady: Event<[string]>` - Data publication ready
- `onMediaPublicationReady: Event<[string, string]>` - Media publication ready
- `onDataChannelMessage: Event<[string]>` - Incoming data messages
- `onDataChannelError: Event<[any]>` - Data channel errors
- `onIceCandidate: Event<[RTCIceCandidate]>` - ICE candidates
- `onConnectionStateChange: Event<[RTCPeerConnectionState]>` - Connection state changes

### DataPublication

- `id: string` - Unique publication ID
- `send(data: string): void` - Send data through the channel
- `close(): void` - Close the publication

### MediaPublication

- `id: string` - Unique publication ID
- `track: MediaStreamTrack` - The published media track
- `close(): void` - Stop publishing

### DataSubscription

- `id: string` - Subscription ID (same as publication ID)
- `onMessage: Event<[string]>` - Messages from this subscription
- `onError: Event<[any]>` - Subscription errors
- `close(): void` - Unsubscribe

### MediaSubscription

- `id: string` - Subscription ID
- `track: MediaStreamTrack | null` - The received media track
- `onTrack: Event<[MediaStreamTrack]>` - Track received event
- `close(): void` - Unsubscribe

## Event Handling

The client uses a custom event system with helpful utilities:

```javascript
// Using promises with timeout
await client.onConnected.asPromise(10000); // Wait up to 10 seconds

// Add event listeners
const handler = (message) => console.log(message);
client.onDataChannelMessage.add(handler);

// Remove event listeners
client.onDataChannelMessage.remove(handler);
```

## Testing

The package includes comprehensive integration tests that verify compatibility with both browser-native and werift WebRTC implementations:

```bash
# Run integration tests
npm test

# Run tests in watch mode
npm run test:watch
```

**Test Coverage:**
- Client-to-client data channel communication
- Media streaming with RTP packet verification
- Integration with werift RTCPeerConnection
- Event handling and lifecycle management

## Development

```bash
# Type checking
npm run type

# Linting and auto-fix
npm run lint

# Run integration tests
npm test

# Run tests in watch mode
npm run test:watch
```

## License

See the root package.json for license information.