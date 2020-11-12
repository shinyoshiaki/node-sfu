import { MediaInfo, RPC } from "../";
import { DataChannelConnection } from "../connection/dc";
import { Main } from "../domain/main";
import { Events } from "../context/events";

export class SFUEndpoint {
  private dcConnection!: DataChannelConnection;

  constructor(private events: Events, private main: Main) {}

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
    const answer = await this.main.handleLeave(infos, offer);
    console.log("dcConnection", this.dcConnection);
    this.dcConnection.sendAnswer(answer);
  };

  private handleJoin = async () => {};

  private handlePublish = (info: MediaInfo) => {
    this.events.onPublish.execute(info);
  };
}
