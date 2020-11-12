import Event from "rx.mini";
import { HandleAnswer, HandleCandidate, RPC } from "../";

export class DataChannelConnection {
  readonly onmessage = new Event<[string]>();

  constructor(private peerId: string, readonly channel: RTCDataChannel) {
    channel.onmessage = ({ data }) => {
      this.onmessage.execute(data);
    };
  }

  sendCandidate(candidate: RTCIceCandidate) {
    this.sendRPC<HandleCandidate>({
      type: "handleCandidate",
      payload: [this.peerId, candidate as any],
    });
  }

  async sendAnswer(answer: RTCSessionDescription) {
    this.sendRPC<HandleAnswer>({
      type: "handleAnswer",
      payload: [this.peerId, answer as any],
    });
    await this.waitRPC("handleAnswerDone");
  }

  waitRPC = <T extends RPC>(target: T["type"]) =>
    new Promise<T["payload"]>((r) => {
      const { unSubscribe } = this.onmessage.subscribe((data) => {
        const { type, payload } = JSON.parse(data) as RPC;
        if (type === target) {
          unSubscribe();
          r(payload);
        }
      });
    });

  sendRPC<T extends RPC>(msg: T) {
    this.channel.send(JSON.stringify(msg));
  }
}
