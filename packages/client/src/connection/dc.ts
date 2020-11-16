import Event from "rx.mini";
import {
  HandleAnswer,
  HandleCandidate,
  RPC,
  Publish,
  ChangeQuality,
  GetMedias,
  HandleMedias,
  HandleOffer,
  Subscribe,
} from "../";

export class DataChannelConnection {
  readonly onmessage = new Event<[string]>();

  constructor(private peerId: string, readonly channel: RTCDataChannel) {
    channel.onmessage = ({ data }) => {
      this.onmessage.execute(data);
    };
  }

  sendCandidate = (candidate: RTCIceCandidate) => {
    this.sendRPC<HandleCandidate>({
      type: "handleCandidate",
      payload: [this.peerId, candidate as any],
    });
  };

  sendAnswer = async (answer: RTCSessionDescription) => {
    this.sendRPC<HandleAnswer>({
      type: "handleAnswer",
      payload: [this.peerId, answer as any],
    });
    await this.waitRPC("handleAnswerDone");
  };

  async publish(payload: Publish["payload"]) {
    this.sendRPC<Publish>({
      type: "publish",
      payload,
    });
    const [offer] = await this.waitRPC<HandleOffer>("handleOffer");
    return offer;
  }

  async getMedias(payload: GetMedias["payload"]) {
    this.sendRPC<GetMedias>({
      type: "getMedias",
      payload,
    });
    const [infos] = await this.waitRPC<HandleMedias>("handleMedias");

    return infos;
  }

  async subscribe(payload: Subscribe["payload"]) {
    this.sendRPC<Subscribe>({
      type: "subscribe",
      payload,
    });
    return await this.waitRPC<HandleOffer>("handleOffer");
  }

  changeQuality(payload: ChangeQuality["payload"]) {
    this.sendRPC<ChangeQuality>({
      type: "changeQuality",
      payload,
    });
  }

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

  private sendRPC<T extends RPC>(msg: T) {
    this.channel.send(JSON.stringify(msg));
  }
}