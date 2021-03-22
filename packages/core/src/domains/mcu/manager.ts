import { MediaStreamTrack } from "../../../../werift/webrtc/src";
import { Media } from "../media/media";
import { MCU } from "./mcu";

export class MCUManager {
  mcu: { [mcuId: string]: MCU } = {};

  getMCU(mcuId: string) {
    return this.mcu[mcuId];
  }

  createMCU(medias: Media[], track: MediaStreamTrack) {
    const mcu = new MCU(medias, track);
    this.mcu[mcu.id] = mcu;
    return mcu;
  }
}
