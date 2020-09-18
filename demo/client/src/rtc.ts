import axios from "axios";

const http = axios.create({ baseURL: "http://127.0.0.1:12222" });

export class RTCManager {
  channel?: RTCDataChannel;
  peerId?: string;
  peer?: RTCPeerConnection;

  join = () =>
    new Promise(async (r) => {
      console.log("join");
      const { peerId, offer } = (await http.get("/join")).data;

      this.peerId = peerId;

      const peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      this.peer = peer;

      peer.onicecandidate = ({ candidate }) => {
        if (candidate) {
          http.post("/candidate", {
            peerId,
            candidate,
          });
        }
      };
      peer.oniceconnectionstatechange = () => {
        console.log("oniceconnectionstatechange", peer.iceConnectionState);
      };
      peer.ondatachannel = ({ channel }) => {
        this.channel = channel;
        peer.onicecandidate = ({ candidate }) => {
          if (candidate) {
            this.sendRPC({
              type: "handleCandidate",
              payload: [peerId, candidate],
            });
          }
        };
        console.log("connected");
        r();
      };

      await peer.setRemoteDescription(offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      http.post("/answer", {
        peerId,
        answer: peer.localDescription,
      });
    });

  async publish(tracks: MediaStreamTrack[], stream: MediaStream) {
    this.sendRPC({
      type: "requestPublish",
      payload: [this.peerId, tracks.map((t) => t.kind)],
    });
    const [offer] = await this.waitRPC("handleOffer");
    tracks.forEach((track) => this.peer?.addTrack(track, stream));
    await this.answer(offer);
  }

  async getTracks(): Promise<TrackInfo[]> {
    this.sendRPC({
      type: "getTracks",
      payload: [this.peerId],
    });
    const [infos] = await this.waitRPC("handleTracks");
    console.log("infos", infos);
    return infos;
  }

  async subscribe(infos: TrackInfo[]) {
    const trackIds = infos.map((v) => `${v.peerId}_${v.id}`);
    this.sendRPC({ type: "subscribe", payload: [this.peerId, trackIds] });
    const [offer] = await this.waitRPC("handleOffer");
    await this.answer(offer);
  }

  private async answer(offer: RTCSessionDescription) {
    console.log("offer", offer.sdp);

    await this.peer?.setRemoteDescription(offer);
    const answer = await this.peer?.createAnswer();
    await this.peer?.setLocalDescription(answer!);

    console.log("answer", this.peer?.localDescription?.sdp);

    this.sendRPC({
      type: "handleAnswer",
      payload: [this.peerId, this.peer?.localDescription],
    });
  }

  private waitRPC = (target: string) =>
    new Promise<any[]>((r) => {
      this.channel!.onmessage = ({ data }) => {
        console.log({ data });
        const { type, payload } = JSON.parse(data) as RPC;
        if (type === target) {
          r(payload);
        }
      };
    });

  private sendRPC(msg: RPC) {
    this.channel?.send(JSON.stringify(msg));
  }
}

type RPC = { type: string; payload: any[] };
type TrackInfo = { id: string; kind: string; peerId: string };
