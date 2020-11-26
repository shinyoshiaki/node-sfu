import { MediaInfo } from "../../../core/src";

export class MCU {
  private _mixers: {
    [mixerId: string]: { id: string; infos: { [mediaId: string]: MediaInfo } };
  } = {};

  constructor(private peer: RTCPeerConnection) {}

  get mixers() {
    return Object.values(this._mixers);
  }

  listen(offer: RTCSessionDescription, mixerId: string) {
    this._mixers[mixerId] = { id: mixerId, infos: {} };
    return this.setOffer(offer);
  }

  unListen(mixerId: string) {
    delete this._mixers[mixerId];
  }

  add(mixerId: string, info: MediaInfo) {
    this._mixers[mixerId].infos[info.mediaId] = info;
  }

  remove(mixerId: string, info: MediaInfo) {
    delete this._mixers[mixerId].infos[info.mediaId];
  }

  private async setOffer(offer: RTCSessionDescription) {
    await this.peer.setRemoteDescription(offer);
    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(answer);
    return this.peer.localDescription;
  }
}
