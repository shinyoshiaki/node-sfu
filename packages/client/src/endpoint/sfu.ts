import { MediaInfo, RPC } from "../";
import { DataChannelConnection } from "../connection/dc";
import { SFU } from "../domain/sfu";
import { Events } from "../context/events";

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

  private handleLeave = async (
    infos: MediaInfo[],
    offer: RTCSessionDescription
  ) => {
    const answer = await this.sfu.handleLeave(infos, offer);
    this.dcConnection.sendAnswer(answer);
  };

  private handleJoin = async (peerId: string) => {
    this.events.onJoin.execute(peerId);
  };

  private handlePublish = (info: MediaInfo) => {
    this.events.onPublish.execute(info);
  };
}
