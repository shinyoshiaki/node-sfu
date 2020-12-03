import { MediaInfo } from "../../";
import { Events } from "../../context/events";
import { Connection } from "../../responder/connection";
import { MCU } from "./mcu";

export class MCUManager {
  private _mixers: {
    [mixerId: string]: MCU;
  } = {};

  constructor(private events: Events, private connection: Connection) {}

  get mixers() {
    return Object.values(this._mixers);
  }

  listen(mixerId: string, mid: string, infos: MediaInfo[]) {
    this._mixers[mixerId] = new MCU(this.connection, this.events, mixerId, mid);
    infos.forEach((info) => this._mixers[mixerId].add(info));
    return this._mixers[mixerId];
  }

  unListen(mixerId: string) {
    delete this._mixers[mixerId];
  }

  getMixer(mixerId: string) {
    return this._mixers[mixerId];
  }
}
