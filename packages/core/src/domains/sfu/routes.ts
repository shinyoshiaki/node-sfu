import { Media } from "../media/media";
import { Route } from "./route";

export class SFURoutes {
  routes: { [mediaId: string]: Route } = {};

  addRoute(media: Media) {
    this.routes[media.mediaId] = new Route(media);
  }

  getRoute(mediaId: string) {
    return this.routes[mediaId];
  }
}
