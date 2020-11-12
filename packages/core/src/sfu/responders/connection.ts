/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  HandleAnswerDone,
  HandleLeave,
  HandleMedias,
  HandleOffer,
  HandlePublish,
  HandleJoin,
  RPC,
} from "../../typings/rpc";
import {
  Kind,
  RTCDataChannel,
  RTCIceCandidateJSON,
  RTCPeerConnection,
  RTCSessionDescription,
} from "../../werift";
import { Room } from "../domains/room";
import { MediaInfo } from "../domains/router";
import { SubscriberType } from "../domains/subscriber";

export class Connection {
  constructor(private room: Room) {}

  listen(channel: RTCDataChannel, peer: RTCPeerConnection, peerId: string) {
    channel.message.subscribe((msg) => {
      try {
        const { type, payload } = JSON.parse(msg as string) as RPC;
        //@ts-ignore
        this[type](...payload);
      } catch (error) {}
    });
    const { unSubscribe } = channel.stateChanged.subscribe((state) => {
      if (state === "open") {
        this.join(peerId);
        unSubscribe();
      }
    });

    peer.iceConnectionStateChange.subscribe((state) => {
      if (state === "disconnected") {
        this.leave(peerId);
        peer.close();
      }
    });
  }

  // ---------------------------------------------------------------------------

  handleAnswer = async (peerId: string, answer: RTCSessionDescription) => {
    const peer = await this.room.handleAnswer(peerId, answer);
    this.sendRPC<HandleAnswerDone>(
      { type: "handleAnswerDone", payload: [] },
      peer
    );
  };

  handleCandidate = async (peerId: string, candidate: RTCIceCandidateJSON) => {
    await this.room.handleCandidate(peerId, candidate);
  };

  leave = async (peerId: string) => {
    const [peers, infos] = await this.room.leave(peerId);
    peers.forEach((peer) =>
      this.sendRPC<HandleLeave>(
        { type: "handleLeave", payload: [infos, peer.localDescription] },
        peer
      )
    );
  };

  publish = async (
    publisherId: string,
    request: { kind: Kind; simulcast: boolean }[]
  ) => {
    this.room.publish(publisherId, request).then((responds) => {
      responds.forEach(([peers, info]) =>
        peers.forEach((peer) => {
          this.sendRPC<HandlePublish>(
            {
              type: "handlePublish",
              payload: [info],
            },
            peer
          );
        })
      );
    });

    const peer = await this.room.createOffer(publisherId);
    this.sendRPC<HandleOffer>(
      {
        type: "handleOffer",
        payload: [peer.localDescription],
      },
      peer
    );
  };

  getMedias = (peerId: string) => {
    const [peer, mediaInfos] = this.room.getMedias(peerId);
    this.sendRPC<HandleMedias>(
      {
        type: "handleMedias",
        payload: [mediaInfos],
      },
      peer
    );
  };

  subscribe = async (
    subscriberId: string,
    requests: { info: MediaInfo; type: SubscriberType }[]
  ) => {
    const [peer, meta] = await this.room.subscribe(subscriberId, requests);
    this.sendRPC<HandleOffer>(
      {
        type: "handleOffer",
        payload: [peer.localDescription, meta],
      },
      peer
    );
  };

  join = (peerId: string) => {
    Object.entries(this.room.peers).forEach(([id, peer]) => {
      if (id === peerId) return;
      this.sendRPC<HandleJoin>({ type: "handleJoin", payload: [peerId] }, peer);
    });
  };

  changeQuality = (
    subscriberId: string,
    info: MediaInfo,
    type: SubscriberType
  ) => {
    this.room.changeQuality(subscriberId, info, type);
  };

  private sendRPC<T extends RPC>(msg: T, peer: RTCPeerConnection) {
    const channel = peer.sctpTransport.channelByLabel("sfu");
    if (!channel) return;
    channel.send(JSON.stringify(msg));
  }
}
