import { Media } from "../media/media";
import { SFU } from "./sfu";

export class SFUManager {
  sfu: { [mediaId: string]: SFU } = {};

  getSFU(mediaId: string) {
    return this.sfu[mediaId];
  }

  createSFU(media: Media) {
    return (this.sfu[media.mediaId] = new SFU(media, () =>
      this.removeSFU(media.mediaId)
    ));
  }

  private removeSFU(mediaId: string) {
    delete this.sfu[mediaId];
  }
}
