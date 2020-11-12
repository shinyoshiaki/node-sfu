import { MediaInfo } from "../sfu/domains/router";
import { SubscriberType } from "../sfu/domains/subscriber";
import { Kind, RTCIceCandidateJSON, RTCSessionDescription } from "../werift";

export interface RPC {
  type: string;
  payload: any[];
}

export interface HandleAnswer extends RPC {
  type: "handleAnswer";
  payload: [string, RTCSessionDescription];
}

export interface HandleAnswerDone extends RPC {
  type: "handleAnswerDone";
  payload: [];
}

export interface HandleCandidate extends RPC {
  type: "handleCandidate";
  payload: [string, RTCIceCandidateJSON];
}

export type RequestPublish = { kind: Kind; simulcast: boolean };

export interface Publish extends RPC {
  type: "publish";
  payload: [string, RequestPublish[]];
}

export interface HandlePublish extends RPC {
  type: "handlePublish";
  payload: [MediaInfo];
}

export interface GetMedias extends RPC {
  type: "getMedias";
  payload: [string];
}

export interface HandleMedias extends RPC {
  type: "handleMedias";
  payload: [MediaInfo[]];
}

export type RequestSubscribe = { info: MediaInfo; type: SubscriberType };
export interface Subscribe extends RPC {
  type: "subscribe";
  payload: [string, RequestSubscribe[]];
}

export interface Leave extends RPC {
  type: "leave";
  payload: [string];
}

export interface HandleJoin extends RPC {
  type: "handleJoin";
  payload: [string];
}

export interface HandleLeave extends RPC {
  type: "handleLeave";
  payload: [MediaInfo[], RTCSessionDescription];
}

export interface HandleOffer extends RPC {
  type: "handleOffer";
  payload: [RTCSessionDescription, ...any[]];
}

export interface ChangeQuality extends RPC {
  type: "changeQuality";
  payload: [string, MediaInfo, SubscriberType];
}
