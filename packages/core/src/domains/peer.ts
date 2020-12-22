import { RTCPeerConnection } from "../../../werift";

export class PeerConnection extends RTCPeerConnection {
  simulcastIndex = 0;
}
