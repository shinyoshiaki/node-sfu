import { MediaInfo } from "..";
import { Events } from "../context/events";

export class SFU {
  private mediaInfoByMID: { [mid: string]: MediaInfo } = {};
  peerId!: string;
  roomName!: string;

  readonly peer: RTCPeerConnection = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  constructor(private events: Events) {
    this.peer.ontrack = (ev) => {
      const mid = ev.transceiver.mid!;
      this.events.onTrack.execute(ev.streams[0], this.mediaInfoByMID[mid]);
    };
  }

  join = (
    offer: RTCSessionDescription,
    {
      onAnswer,
      onIceCandidate,
    }: {
      onIceCandidate: (candidate: RTCIceCandidate) => void;
      onAnswer: (answer: RTCSessionDescription) => void;
    }
  ) =>
    new Promise<RTCDataChannel>(async (r) => {
      this.peer.onicecandidate = ({ candidate }) => {
        if (candidate) onIceCandidate(candidate);
      };
      this.peer.ondatachannel = ({ channel }) => r(channel);

      onAnswer(await this.setOffer(offer));
    });

  async publish(
    requests: { track: MediaStreamTrack; simulcast: boolean }[],
    offer: RTCSessionDescription
  ) {
    await this.peer.setRemoteDescription(offer);

    requests
      .map(({ track, simulcast }): [RTCRtpSender, boolean] => [
        this.peer.addTrack(track)!,
        simulcast,
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

  async subscribe(
    pairs: any[],
    infos: MediaInfo[],
    offer: RTCSessionDescription
  ) {
    pairs.forEach(({ mid, mediaId }) => {
      this.mediaInfoByMID[mid] = infos.find((v) => v.mediaId === mediaId)!;
    });

    return this.setOffer(offer);
  }

  async handleLeave(infos: MediaInfo[], offer: RTCSessionDescription) {
    this.events.onLeave.execute(infos);

    return await this.setOffer(offer);
  }

  private async setOffer(offer: RTCSessionDescription) {
    await this.peer.setRemoteDescription(offer);
    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(answer);
    return this.peer.localDescription;
  }
}
