import axios from "axios";
import Event from "rx.mini";
import { PromiseQueue } from "./util";

export class RTCManager {
  channel?: RTCDataChannel;
  peerId?: string;
  peer: RTCPeerConnection = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });
  trackIds: string[] = [];
  private onmessage = new Event<string>();
  onPublish = new Event<TrackInfo>();
  onLeave = new Event<string[]>();
  http = axios.create({ baseURL: this.url });

  constructor(private url: string) {}

  join = () =>
    new Promise(async (r) => {
      console.log("join");
      const { peerId, offer } = (await this.http.get("/join")).data;

      this.peerId = peerId;

      const peer = this.peer;

      peer.onicecandidate = ({ candidate }) => {
        if (candidate) {
          this.http.post("/candidate", {
            peerId,
            candidate,
          });
        }
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

        channel.onmessage = ({ data }) => {
          this.onmessage.execute(data);

          const { type, payload } = JSON.parse(data) as RPC;
          console.log(type, payload);
          //@ts-ignore
          if (this[type]) {
            //@ts-ignore
            this[type](...payload);
          }
        };

        console.log("connected");
        r();
      };

      await peer.setRemoteDescription(offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      await this.http.post("/answer", {
        peerId,
        answer: peer.localDescription,
      });
    });

  async publish(tracks: MediaStreamTrack[], simulcast: boolean = false) {
    this.sendRPC({
      type: "publish",
      payload: [this.peerId, tracks.map((t) => t.kind), simulcast],
    });
    const [offer] = await this.waitRPC("handleOffer");

    await this.peer.setRemoteDescription(offer);

    tracks
      .map((track) => this.peer.addTrack(track)!)
      .map((sender) => {
        if (!simulcast) return;
        const params = sender.getParameters();
        params.encodings = [
          {
            rid: "high",
            scaleResolutionDownBy: 1,
          },
          {
            rid: "low",
            maxBitrate: 50000,
            scaleResolutionDownBy: 2,
          },
        ];
        sender.setParameters(params);
      });

    await this.peer.setLocalDescription(await this.peer.createAnswer());
    console.log("sending answer");
    await this.sendAnswer();
    console.log("sending answer done");
  }

  async getTracks(): Promise<TrackInfo[]> {
    this.sendRPC({
      type: "getTracks",
      payload: [this.peerId],
    });
    const [infos] = await this.waitRPC("handleTracks");
    console.log("infos", infos);
    await new Promise((r) => setTimeout(r, 100));
    return infos;
  }

  subscribeQueue = new PromiseQueue();
  async subscribe(infos: TrackInfo[]) {
    await this.subscribeQueue.push(async () => {
      this.sendRPC({ type: "subscribe", payload: [this.peerId, infos] });
      const [offer] = await this.waitRPC("handleOffer");
      await this.peer.setRemoteDescription(offer);
      const answer = await this.peer.createAnswer();
      await this.peer.setLocalDescription(answer!);

      await this.sendAnswer();
    });
  }

  private handlePublish = (info: TrackInfo) => {
    console.log("handlePublish", info);
    this.onPublish.execute(info);
  };

  private handleLeave = async (
    infos: TrackInfo[],
    offer: RTCSessionDescription
  ) => {
    console.log("handleLeave", infos);
    await this.peer.setRemoteDescription(offer);
    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(answer!);
    await this.sendAnswer();
  };

  private waitRPC = (target: string) =>
    new Promise<any[]>((r) => {
      const { unSubscribe } = this.onmessage.subscribe((data) => {
        const { type, payload } = JSON.parse(data) as RPC;
        if (type === target) {
          unSubscribe();
          r(payload);
        }
      });
    });

  async sendAnswer() {
    this.sendRPC({
      type: "handleAnswer",
      payload: [this.peerId, this.peer.localDescription],
    });
    await this.waitRPC("handleAnswerDone");
  }

  private sendRPC(msg: RPC) {
    this.channel?.send(JSON.stringify(msg));
  }
}

type RPC = { type: string; payload: any[] };
type TrackInfo = { mediaId: string; kind: string; publisherId: string };
