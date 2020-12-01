import { Media } from "../media/media";
import { SFU } from "./sfu";

export class SFUManager {
  sfu: { [mediaId: string]: SFU } = {};

  getSFU(media: Media) {
    if (!this.sfu[media.mediaId]) {
      const sfu = (this.sfu[media.mediaId] = new SFU(media));
    }
    return this.sfu[media.mediaId];
  }

  private removeSFU(mediaId: string) {
    delete this.sfu[mediaId];
  }
}
