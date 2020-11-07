/* eslint-disable @typescript-eslint/ban-ts-comment */
import axios from "axios";
import Event from "rx.mini";
import { PromiseQueue } from "./util";
import {
  MediaInfo,
  Kind,
  HandleCandidate,
  Publish,
  RPC,
  GetMedias,
  HandleOffer,
  HandleMedias,
  Subscribe,
  RequestSubscribe,
  HandleAnswer,
  SubscriberType,
  ChangeQuality,
} from "../../../core/src";

export class RTCManager {
  private http = axios.create({ baseURL: this.url });
  private onmessage = new Event<string>();
  roomName!: string;
  channel?: RTCDataChannel;
  peerId?: string;
  peer: RTCPeerConnection = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });
  mediaInfoByMID: { [mid: string]: MediaInfo } = {};
  onPublish = new Event<MediaInfo>();
  onLeave = new Event<string[]>();
  onTrack = new Event<{ stream: MediaStream; info: MediaInfo }>();

  constructor(private url: string) {
    this.peer.ontrack = (ev) => {
      const mid = ev.transceiver.mid!;
      this.onTrack.execute({
        stream: ev.streams[0],
        info: this.mediaInfoByMID[mid],
      });
    };
  }

  async create() {
    const { roomName } = (await this.http.post("/create")).data;
    this.roomName = roomName;
  }

  join = () =>
    new Promise(async (r) => {
      console.log("join");
      const { peerId, offer } = (
        await this.http.put("/join", { roomName: this.roomName })
      ).data;

      this.peerId = peerId;

      const peer = this.peer;

      peer.onicecandidate = ({ candidate }) => {
        if (candidate) {
          this.http.post("/candidate", {
            peerId,
            candidate,
            roomName: this.roomName,
          });
        }
      };
      peer.ondatachannel = ({ channel }) => {
        this.channel = channel;
        peer.onicecandidate = ({ candidate }) => {
          if (candidate) {
            this.sendRPC<HandleCandidate>({
              type: "handleCandidate",
              payload: [peerId, candidate as any],
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
        roomName: this.roomName,
      });
    });

  async publish(requests: { track: MediaStreamTrack; simulcast: boolean }[]) {
    this.sendRPC<Publish>({
      type: "publish",
      payload: [
        this.peerId!,
        requests.map(({ track, simulcast }) => ({
          kind: track.kind as Kind,
          simulcast,
        })),
      ],
    });
    const [offer] = await this.waitRPC<HandleOffer>("handleOffer");

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
    console.log("sending answer");
    await this.sendAnswer();
    console.log("sending answer done");
  }

  async getTracks() {
    this.sendRPC<GetMedias>({
      type: "getMedias",
      payload: [this.peerId!],
    });
    const [infos] = await this.waitRPC<HandleMedias>("handleMedias");
    console.log("infos", infos);
    return infos;
  }

  subscribeQueue = new PromiseQueue();
  async subscribe(infos: MediaInfo[]) {
    await this.subscribeQueue.push(async () => {
      this.sendRPC<Subscribe>({
        type: "subscribe",
        payload: [
          this.peerId!,
          infos.map(
            (info): RequestSubscribe => ({
              info,
              type: "high",
            })
          ),
        ],
      });
      const [offer, pairs] = await this.waitRPC<HandleOffer>("handleOffer");
      console.log({ pairs });
      // @ts-ignore
      (pairs as any[]).forEach(({ mid, mediaId }) => {
        this.mediaInfoByMID[mid] = infos.find((v) => v.mediaId === mediaId)!;
      });

      await this.peer.setRemoteDescription(offer);
      const answer = await this.peer.createAnswer();
      await this.peer.setLocalDescription(answer!);

      await this.sendAnswer();
    });
  }

  changeQuality(info: MediaInfo, type: SubscriberType) {
    this.sendRPC<ChangeQuality>({
      type: "changeQuality",
      payload: [this.peerId!, info, type],
    });
  }

  private handlePublish = (info: MediaInfo) => {
    console.log("handlePublish", info);
    this.onPublish.execute(info);
  };

  private handleLeave = async (
    infos: MediaInfo[],
    offer: RTCSessionDescription
  ) => {
    console.log("handleLeave", infos);
    await this.peer.setRemoteDescription(offer);
    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(answer!);
    await this.sendAnswer();
  };

  private waitRPC = <T extends RPC>(target: T["type"]) =>
    new Promise<T["payload"]>((r) => {
      const { unSubscribe } = this.onmessage.subscribe((data) => {
        const { type, payload } = JSON.parse(data) as RPC;
        if (type === target) {
          unSubscribe();
          r(payload);
        }
      });
    });

  async sendAnswer() {
    console.log("answer", this.peer.localDescription?.sdp);
    this.sendRPC<HandleAnswer>({
      type: "handleAnswer",
      payload: [this.peerId!, this.peer.localDescription as any],
    });
    await this.waitRPC("handleAnswerDone");
  }

  private sendRPC<T extends RPC>(msg: T) {
    this.channel?.send(JSON.stringify(msg));
  }
}
