import { subscribe } from "../actions/sfu";
import { join, publish } from "../actions/user";
import { User } from "../domain/user";
import { Connection } from "./connection";
import { MediaInfo, SubscriberType } from "../../";
import { SFUManager } from "../domain/sfu/manager";
import { Events } from "../../context/events";
import { MCUManager } from "../domain/mcu/manager";
import { listenMixedAudio } from "../actions/mcu";

export class ClientSDK {
  events = new Events();
  connection = new Connection(this.events);
  sfu = new SFUManager(this.events, this.connection);
  mcu = new MCUManager(this.events, this.connection);
  user: User;

  get peerId() {
    return this.user.peerId;
  }

  async join(roomName: string, peerId: string, offer: RTCSessionDescription) {
    const { answer, user, candidates } = await join(this.connection)(
      roomName,
      peerId,
      offer
    );
    this.user = user;

    return { answer, candidates, user };
  }

  async publish(requests: { track: MediaStreamTrack; simulcast?: boolean }[]) {
    await publish(this.connection, this.user)(requests);
  }

  async unPublish(info: MediaInfo) {
    if (info.publisherId !== this.peerId) return;
    this.events.onUnPublish.execute(info);

    await this.connection.unPublish([info]);
  }

  async subscribe(infos: MediaInfo[]) {
    subscribe(this.connection, this.sfu)(infos);
  }

  async getMedias() {
    return this.connection.getMedias();
  }

  async listenMixedAudio(infos: MediaInfo[]) {
    return await listenMixedAudio(this.connection, this.mcu)(infos);
  }

  addMixedAudioTrack(mixerId: string, info: MediaInfo) {
    this.mcu.getMixer(mixerId).add(info);
    this.connection.addMixedAudioTrack([mixerId, info]);
  }

  removeMixedAudioTrack(mixerId: string, info: MediaInfo) {
    this.mcu.getMixer(mixerId).remove(info);
    this.connection.removeMixedAudioTrack([mixerId, info]);
  }

  changeQuality(info: MediaInfo, type: SubscriberType) {
    this.connection.changeQuality([this.peerId, info, type]);
  }
}
