import {
  HandleJoin,
  HandleLeave,
  HandlePublish,
  HandleUnPublish,
  RPC,
} from "../";
import { DataChannelConnection } from "../connection/dc";
import { Events } from "../context/events";
import { SFU } from "../domain/sfu";

export class SFUEndpoint {
  private dcConnection!: DataChannelConnection;

  constructor(private events: Events, private sfu: SFU) {}

  listen(dcConnection: DataChannelConnection) {
    this.dcConnection = dcConnection;
    this.dcConnection.onmessage.subscribe((data) => {
      const { type, payload } = JSON.parse(data) as RPC;
      console.log(type, payload);
      //@ts-ignore
      if (this[type]) {
        //@ts-ignore
        this[type](...payload);
      }
    });
  }

  private handleLeave = async (...args: HandleLeave["payload"]) => {
    const [infos, offer] = args;
    const answer = await this.sfu.handleLeave(infos, offer as any);
    this.dcConnection.sendAnswer(answer);
  };

  private handleJoin = async (...args: HandleJoin["payload"]) => {
    const [peerId] = args;
    this.events.onJoin.execute(peerId);
  };

  private handlePublish = (...args: HandlePublish["payload"]) => {
    const [info] = args;
    this.events.onPublish.execute(info);
  };

  private handleUnPublish = async (...args: HandleUnPublish["payload"]) => {
    const [info, offer] = args;
    this.events.onUnPublish.execute(info);
    const answer = await this.sfu.setOffer(offer as any);
    await this.dcConnection.sendAnswer(answer);
  };
}
