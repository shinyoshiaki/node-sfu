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
import { Main } from "../domain/main";
import { SFUEndpoint } from "./sfu";
import { Events } from "../context/events";

export class ClientSDK {
  private readonly httpConnection = new HttpConnection({ url: this.url });
  private dcConnection!: DataChannelConnection;
  private readonly events = new Events();
  private readonly main = new Main(this.events);
  private readonly sfuEndpoint = new SFUEndpoint(this.events, this.main);
  private subscribeQueue = new PromiseQueue();

  roomName!: string;
  readonly onPublish = this.events.onPublish;
  readonly onLeave = this.events.onLeave;
  readonly onJoin = this.events.onJoin;
  readonly onTrack = this.events.onTrack;

  constructor(private url: string) {}

  get peerId() {
    return this.main.peerId;
  }

  async create() {
    this.roomName = await this.httpConnection.create();
  }

  async join() {
    const { offer, peerId } = await this.httpConnection.join(this.roomName);
    this.main.peerId = peerId;

    const channel = await this.main.join(
      offer,
      (c) => this.httpConnection.candidate(peerId, this.roomName, c),
      (a) => this.httpConnection.answer(peerId, this.roomName, a)
    );

    this.dcConnection = new DataChannelConnection(peerId, channel);
    this.main.peer.onicecandidate = ({ candidate }) => {
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
        this.main.peerId,
        requests.map(({ track, simulcast }) => ({
          kind: track.kind as Kind,
          simulcast,
        })),
      ],
    });
    const [offer] = await this.dcConnection.waitRPC<HandleOffer>("handleOffer");
    const answer = await this.main.publish(requests, offer as any);
    this.dcConnection.sendAnswer(answer);
  }

  async getTracks() {
    this.dcConnection.sendRPC<GetMedias>({
      type: "getMedias",
      payload: [this.main.peerId],
    });
    const [infos] = await this.dcConnection.waitRPC<HandleMedias>(
      "handleMedias"
    );
    return infos;
  }

  async subscribe(infos: MediaInfo[]) {
    await this.subscribeQueue.push(async () => {
      this.dcConnection.sendRPC<Subscribe>({
        type: "subscribe",
        payload: [
          this.main.peerId,
          infos.map(
            (info): RequestSubscribe => ({
              info,
              type: "high",
            })
          ),
        ],
      });
      const [offer, pairs] = await this.dcConnection.waitRPC<HandleOffer>(
        "handleOffer"
      );
      const answer = await this.main.subscribe(pairs, infos, offer as any);
      await this.dcConnection.sendAnswer(answer);
    });
  }

  changeQuality(info: MediaInfo, type: SubscriberType) {
    this.dcConnection.sendRPC<ChangeQuality>({
      type: "changeQuality",
      payload: [this.main.peerId, info, type],
    });
  }
}
