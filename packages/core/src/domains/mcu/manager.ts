import { RTCRtpTransceiver } from "../../../../werift";
import { Media } from "../media/media";
import { MCUMixer } from "./mixer";

export class MCUManager {
  mixers: { [mixerId: string]: MCUMixer } = {};

  subscribe(medias: Media[], sender: RTCRtpTransceiver) {
    const mixer = new MCUMixer(medias, sender);
    this.mixers[mixer.id] = mixer;
  }

  addMedia(mixerId: string, media: Media) {
    const mixer = this.mixers[mixerId];
    mixer.inputMedia(media.tracks[0].track);
  }

  close(mixerId: string) {
    const mixer = this.mixers[mixerId];
    mixer.close();
    delete this.mixers[mixerId];
  }
}
