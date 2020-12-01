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

  leave(subscriberId: string) {
    Object.values(this.sfu).forEach((sfu) => sfu.leave(subscriberId));
  }

  private removeSFU(mediaId: string) {
    delete this.sfu[mediaId];
  }
}
