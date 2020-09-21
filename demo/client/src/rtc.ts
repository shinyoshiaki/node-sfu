import axios from "axios";
import Event from "rx.mini";

export class RTCManager {
  channel?: RTCDataChannel;
  peerId?: string;
  peer?: RTCPeerConnection;
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

      const peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      this.peer = peer;

      peer.onicecandidate = ({ candidate }) => {
        if (candidate) {
          this.http.post("/candidate", {
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

      this.http.post("/answer", {
        peerId,
        answer: peer.localDescription,
      });
    });

  async publish(tracks: MediaStreamTrack[]) {
    this.sendRPC({
      type: "publish",
      payload: [this.peerId, tracks.map((t) => t.kind)],
    });
    const [offer] = await this.waitRPC("handleOffer");

    await this.peer?.setRemoteDescription(offer);

    this.peer
      ?.getTransceivers()
      .slice(-tracks.length)
      .forEach((transceiver, i) => {
        transceiver.sender.replaceTrack(tracks[i]);
        transceiver.direction = "sendonly";
      });

    const answer = await this.peer?.createAnswer();
    await this.peer?.setLocalDescription(answer!);

    this.sendRPC({
      type: "handleAnswer",
      payload: [this.peerId, this.peer?.localDescription],
    });
    await new Promise((r) => setTimeout(r, 100));
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

  async subscribe(infos: TrackInfo[]) {
    const trackIds = infos.map((v) => `${v.peerId}_${v.mediaId}`);
    this.sendRPC({ type: "subscribe", payload: [this.peerId, trackIds] });
    const [offer] = await this.waitRPC("handleOffer");
    await this.peer?.setRemoteDescription(offer);
    const answer = await this.peer?.createAnswer();
    await this.peer?.setLocalDescription(answer!);

    this.sendRPC({
      type: "handleAnswer",
      payload: [this.peerId, this.peer?.localDescription],
    });
  }

  private handlePublish = (info: TrackInfo) => {
    console.log("handlePublish", info);
    this.onPublish.execute(info);
  };

  private handleLeave = (streamIds: string[]) => {
    console.log("handleLeave", streamIds);
    this.onLeave.execute(streamIds);
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

  private sendRPC(msg: RPC) {
    this.channel?.send(JSON.stringify(msg));
  }
}

type RPC = { type: string; payload: any[] };
type TrackInfo = { mediaId: string; kind: string; peerId: string };
