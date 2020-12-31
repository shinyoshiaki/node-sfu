import { RTCRtpTransceiver } from "../../../../werift/webrtc/src";
import { Media } from "../media/media";
import { MCU } from "./mcu";

export class MCUManager {
  mcu: { [mcuId: string]: MCU } = {};

  getMCU(mcuId: string) {
    return this.mcu[mcuId];
  }

  createMCU(medias: Media[], subscriber: RTCRtpTransceiver) {
    const mcu = new MCU(medias, subscriber);
    this.mcu[mcu.id] = mcu;
    return mcu;
  }
}
