import { RTCRtpTransceiver } from "../../../../werift";
import { Media } from "../media/media";
import { MCUMixer } from "./mixer";

export class MCUManager {
  mixers: { [mixerId: string]: MCUMixer } = {};

  subscribe(medias: Media[], sender: RTCRtpTransceiver) {
    const mixer = new MCUMixer(medias, sender);
    this.mixers[mixer.id] = mixer;
    return mixer.id;
  }

  addMedia(mixerId: string, media: Media) {
    const mixer = this.mixers[mixerId];
    mixer.inputMedia(media);
  }

  removeMedia(mixerId: string, mediaId: string) {
    const mixer = this.mixers[mixerId];
    mixer.removeMedia(mediaId);
  }

  close(mixerId: string) {
    const mixer = this.mixers[mixerId];
    mixer.close();
    delete this.mixers[mixerId];
  }
}
