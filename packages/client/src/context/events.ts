import Event from "rx.mini";
import { MediaInfo } from "../";
import { MCU } from "../domain/mcu/mcu";

export class Events {
  readonly onConnect = new Event();
  readonly onPublish = new Event<[MediaInfo]>();
  readonly onUnPublish = new Event<[MediaInfo]>();
  readonly onLeave = new Event<[MediaInfo[]]>();
  readonly onJoin = new Event<[string]>();
  readonly onTrack = new Event<[MediaStream, MediaInfo]>();
  readonly onDataChannel = new Event<[RTCDataChannel]>();
  readonly onUnsubscribe = new Event<[MediaInfo]>();
  readonly onMixerCreated = new Event<[MCU]>();
}
