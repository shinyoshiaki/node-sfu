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
    requests: { track: MediaStreamTrack; simulcast?: boolean }[],
    offer: RTCSessionDescription
  ) {
    await this.peer.setRemoteDescription(offer);

    requests
      .map(({ track, simulcast }): [RTCRtpSender, boolean] => [
        this.peer.addTrack(track)!,
        !!simulcast,
      ])
      .map(([sender, simulcast]) => {
        if (!simulcast) return;
        const params = sender.getParameters();
        params.encodings = [
          { maxBitrate: 680000, scaleResolutionDownBy: 1, rid: "high" },
          { maxBitrate: 36000, scaleResolutionDownBy: 4, rid: "low" },
        ];
        sender.setParameters(params);
      });

    await this.peer.setLocalDescription(await this.peer.createAnswer());
    return this.peer.localDescription;
  }
}
