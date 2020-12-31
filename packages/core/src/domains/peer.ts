import { RTCPeerConnection } from "../../../werift/webrtc/src";

export class PeerConnection extends RTCPeerConnection {
  simulcastIndex = 0;
}
