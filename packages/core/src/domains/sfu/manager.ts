import { Media } from "../media/media";
import { SFURouter } from "./router";

export class SFUManager {
  routes: { [mediaId: string]: SFURouter } = {};

  addRoute(media: Media) {
    this.routes[media.mediaId] = new SFURouter(media);
  }

  getRoute(mediaId: string) {
    return this.routes[mediaId];
  }
}
