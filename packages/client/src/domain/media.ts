import { MediaInfo } from "..";
import { Events } from "../context/events";

export class Media {
  infos: { [mediaId: string]: MediaInfo } = {};

  constructor(private events: Events) {
    events.onPublish.subscribe((info) => {
      this.infos[info.mediaId] = info;
    });
    events.onUnPublish.subscribe((info) => {
      delete this.infos[info.mediaId];
    });
  }
}
