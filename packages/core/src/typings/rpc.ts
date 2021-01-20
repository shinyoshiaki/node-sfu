import {
  Kind,
  RTCIceCandidateJSON,
  RTCSessionDescription,
} from "../../../werift/webrtc/src";
import { MediaInfo } from "../domains/media/media";
import { SubscriberType } from "../domains/sfu/subscriber";

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
  payload: [string, RequestPublish];
}

export interface UnPublish extends RPC {
  type: "unPublish";
  payload: [MediaInfo];
}

export interface HandlePublish extends RPC {
  type: "handlePublish";
  payload: [MediaInfo];
}

export interface HandlePublishDone extends RPC {
  type: "handlePublishDone";
  payload: [MediaInfo, RTCSessionDescription | undefined];
}

export interface HandleUnPublish extends RPC {
  type: "handleUnPublish";
  payload: [MediaInfo, RTCSessionDescription];
}

export interface HandleUnPublishDone extends RPC {
  type: "handleUnPublishDone";
  payload: [RTCSessionDescription];
}

export interface GetMedias extends RPC {
  type: "getMedias";
  payload: [string];
}

export interface HandleMedias extends RPC {
  type: "handleMedias";
  payload: [MediaInfo[]];
}

export type RequestSubscribe = { info: MediaInfo; type?: SubscriberType };
export interface Subscribe extends RPC {
  type: "subscribe";
  payload: [string, RequestSubscribe[]];
}

export type MediaIdPair = {
  mediaId: string;
  mid?: string;
  label?: string;
};

export interface HandleSubscribe extends RPC {
  type: "handleSubscribe";
  payload: [MediaIdPair[], RTCSessionDescription | undefined];
}

export interface UnSubscribe extends RPC {
  type: "unsubscribe";
  payload: [MediaInfo, string];
}

export interface HandleUnSubscribe extends RPC {
  type: "handleUnsubscribe";
  payload: [RTCSessionDescription];
}

export interface ListenMixedAudio extends RPC {
  type: "listenMixedAudio";
  payload: [string, MediaInfo[]];
}

export type MixIdPair = {
  mid: string;
  mixId: string;
};

export interface HandleListenMixedAudio extends RPC {
  type: "handleListenMixedAudio";
  payload: [RTCSessionDescription, MixIdPair];
}

export interface AddMixedAudioTrack extends RPC {
  type: "addMixedAudioTrack";
  payload: [string, MediaInfo];
}

export interface RemoveMixedAudioTrack extends RPC {
  type: "removeMixedAudioTrack";
  payload: [string, MediaInfo];
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
  payload: [MediaInfo[], RTCSessionDescription | undefined];
}

export interface ChangeQuality extends RPC {
  type: "changeQuality";
  payload: [string, MediaInfo, SubscriberType];
}
