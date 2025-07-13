import type { MediaStreamTrackLike } from "./type.js";

export class MediaPublication {
  constructor(
    public readonly publicationId: string,
    public readonly track: MediaStreamTrackLike,
  ) {}
}
