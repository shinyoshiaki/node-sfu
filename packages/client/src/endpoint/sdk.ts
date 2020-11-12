/* eslint-disable @typescript-eslint/ban-ts-comment */
import { PromiseQueue } from "../util";
import {
  MediaInfo,
  Kind,
  Publish,
  GetMedias,
  HandleOffer,
  HandleMedias,
  Subscribe,
  RequestSubscribe,
  SubscriberType,
  ChangeQuality,
} from "../";
import { HttpConnection } from "../connection/http";
import { DataChannelConnection } from "../connection/dc";
import { SFU } from "../domain/sfu";
import { SFUEndpoint } from "./sfu";
import { Events } from "../context/events";

export class ClientSDK {
  private readonly httpConnection = new HttpConnection({ url: this.url });
  private dcConnection!: DataChannelConnection;
  private readonly events = new Events();
  private readonly sfu = new SFU(this.events);
  private readonly sfuEndpoint = new SFUEndpoint(this.events, this.sfu);
  private subscribeQueue = new PromiseQueue();

  readonly onPublish = this.events.onPublish;
  readonly onLeave = this.events.onLeave;
  readonly onJoin = this.events.onJoin;
  readonly onTrack = this.events.onTrack;

  constructor(private url: string) {}

  get peerId() {
    return this.sfu.peerId;
  }

  get roomName() {
    return this.sfu.roomName;
  }
  set roomName(roomName: string) {
    this.sfu.roomName = roomName;
  }

  async create() {
    this.sfu.roomName = await this.httpConnection.create();
  }

  async join() {
    const { offer, peerId } = await this.httpConnection.join(this.roomName);
    this.sfu.peerId = peerId;

    const channel = await this.sfu.join(offer, {
      onIceCandidate: (candidate) =>
        this.httpConnection.candidate(peerId, this.roomName, candidate),
      onAnswer: (answer) =>
        this.httpConnection.answer(peerId, this.roomName, answer),
    });

    this.dcConnection = new DataChannelConnection(peerId, channel);
    this.sfu.peer.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.dcConnection.sendCandidate(candidate);
      }
    };
    this.sfuEndpoint.listen(this.dcConnection);
  }

  async publish(requests: { track: MediaStreamTrack; simulcast: boolean }[]) {
    this.dcConnection.sendRPC<Publish>({
      type: "publish",
      payload: [
        this.peerId,
        requests.map(({ track, simulcast }) => ({
          kind: track.kind as Kind,
          simulcast,
        })),
      ],
    });
    const [offer] = await this.dcConnection.waitRPC<HandleOffer>("handleOffer");
    const answer = await this.sfu.publish(requests, offer as any);
    await this.dcConnection.sendAnswer(answer);
  }

  async getTracks() {
    this.dcConnection.sendRPC<GetMedias>({
      type: "getMedias",
      payload: [this.peerId],
    });
    const [infos] = await this.dcConnection.waitRPC<HandleMedias>(
      "handleMedias"
    );
    return infos;
  }

  async subscribe(infos: MediaInfo[]) {
    await this.subscribeQueue.push(async () => {
      const requests: RequestSubscribe[] = infos.map((info) => ({
        info,
        type: "high",
      }));
      this.dcConnection.sendRPC<Subscribe>({
        type: "subscribe",
        payload: [this.peerId, requests],
      });
      const [offer, pairs] = await this.dcConnection.waitRPC<HandleOffer>(
        "handleOffer"
      );
      const answer = await this.sfu.subscribe(pairs, infos, offer as any);
      await this.dcConnection.sendAnswer(answer);
    });
  }

  changeQuality(info: MediaInfo, type: SubscriberType) {
    this.dcConnection.sendRPC<ChangeQuality>({
      type: "changeQuality",
      payload: [this.peerId, info, type],
    });
  }
}
