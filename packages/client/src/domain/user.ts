import Event from "rx.mini";
import { MediaInfo } from "../";
import { Connection } from "../responder/connection";

export class User {
  private readonly peer = this.connection.peer;

  peerId!: string;
  candidates: RTCIceCandidate[] = [];
  onCandidate = new Event<[RTCIceCandidate]>();
  published: MediaInfo[] = [];

  constructor(readonly roomName: string, private connection: Connection) {}

  join = async (peerId: string, offer: RTCSessionDescription) => {
    this.peerId = peerId;
    this.connection.peerId = peerId;

    // datachannelが開かれるまで
    this.peer.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.candidates.push(candidate);
        this.onCandidate.execute(candidate);
      }
    };

    const answer = await this.connection.setOffer(offer);
    return { answer, candidates: this.candidates };
  };

  async publish(
    request: { track?: MediaStreamTrack; simulcast?: boolean; data?: boolean },
    offer: RTCSessionDescription | undefined
  ) {
    if (offer) {
      await this.peer.setRemoteDescription(offer);
    }

    if (request.track) {
      const transceiver = this.peer.getTransceivers().slice(-1)[0];
      transceiver.sender.replaceTrack(request.track);
      transceiver.direction = "sendonly";

      if (request.simulcast) {
        const params = transceiver.sender.getParameters();
        params.encodings[0] = {
          ...params.encodings[0],
          maxBitrate: 680000,
          scaleResolutionDownBy: 1,
        };
        params.encodings[1] = {
          ...params.encodings[1],
          maxBitrate: 36000,
          scaleResolutionDownBy: 4,
        };
        transceiver.sender.setParameters(params);
      }
    }
    if (offer)
      await this.peer.setLocalDescription(await this.peer.createAnswer());
    return this.peer;
  }
}
