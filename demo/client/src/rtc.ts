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

  async publish(tracks: MediaStreamTrack[]) {
    this.sendRPC({
      type: "requestPublish",
      payload: [this.peerId, tracks.map((t) => t.kind)],
    });
    const [offer] = await this.waitRPC("handleOffer");
    tracks.forEach((track) => this.peer?.addTrack(track));
    await this.peer?.setRemoteDescription(offer);
    const answer = await this.peer?.createAnswer();
    await this.peer?.setLocalDescription(answer!);

    this.sendRPC({
      type: "handleAnswer",
      payload: [this.peerId, this.peer?.localDescription],
    });
  }

  async getTracks() {
    this.sendRPC({
      type: "getTracks",
      payload: [this.peerId],
    });
    const [infos] = await this.waitRPC("handleTracks");
    console.log("infos", infos);
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
