import { MediaInfo } from "../../../../core/src";

export class Producer {
  datachannel: RTCDataChannel;
  constructor(readonly info: MediaInfo) {}

  sendData(data: string | ArrayBuffer | Blob) {
    this.datachannel.send(data as any);
  }
}
