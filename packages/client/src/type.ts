import type { MediaStreamTrack as WeriftTrack } from "../../../submodules/werift/packages/webrtc/src/index.js";

export type MediaStreamTrackLike = Partial<MediaStreamTrack> &
  Partial<WeriftTrack>;
