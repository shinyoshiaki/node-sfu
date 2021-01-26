/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  RTCDataChannel,
  RTCIceCandidateJSON,
  RTCPeerConnection,
  RTCSessionDescription,
} from "../../../werift/webrtc/src";
import {
  addMixedAudioTrack,
  listenMixedAudio,
  removeMixedAudioTrack,
} from "../actions/mcu";
import { leave, unPublish } from "../actions/room";
import { changeQuality, subscribe, unsubscribe } from "../actions/sfu";
import { Room } from "../domains/room";
import {
  AddMixedAudioTrack,
  ChangeQuality,
  GetMedias,
  HandleAnswerDone,
  HandleJoin,
  HandleLeave,
  HandleListenMixedAudio,
  HandleMedias,
  HandlePublish,
  HandlePublishDone,
  HandleSubscribe,
  HandleUnPublish,
  HandleUnPublishDone,
  HandleUnSubscribe,
  Leave,
  ListenMixedAudio,
  Publish,
  RemoveMixedAudioTrack,
  RPC,
  Subscribe,
  UnPublish,
  UnSubscribe,
} from "../typings/rpc";

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
        if (this.room.peers[peerId]) {
          this.leave(peerId);
          peer.close();
        }
      }
    });
  }

  private async createOffer(peerID: string) {
    const peer = this.room.peers[peerID];
    await peer.setLocalDescription(peer.createOffer());
    return peer;
  }

  handleAnswer = async (peerId: string, answer: RTCSessionDescription) => {
    const peer = this.room.peers[peerId];
    await peer.setRemoteDescription(answer);
    this.sendRPC<HandleAnswerDone>(
      { type: "handleAnswerDone", payload: [] },
      peer
    );
  };

  handleCandidate = async (peerId: string, candidate: RTCIceCandidateJSON) => {
    const peer = this.room.peers[peerId];
    await peer.addIceCandidate(candidate);
  };

  // ---------------------------------------------------------------------------

  leave = async (peerId: Leave["payload"][0]) => {
    const { peers, infos } = await leave(this.room)(peerId);
    peers.forEach((peer) => {
      const offer =
        peer.signalingState === "have-local-offer"
          ? peer.localDescription
          : undefined;

      this.sendRPC<HandleLeave>(
        {
          type: "handleLeave",
          payload: [infos, offer],
        },
        peer
      );
    });
  };

  publish = async (...args: Publish["payload"]) => {
    const [publisherId, request] = args;

    const { media, peer } = this.room.createMedia(publisherId, request);
    this.room.publish(media).then(({ peers, info }) => {
      peers.forEach((peer) => {
        this.sendRPC<HandlePublish>(
          { type: "handlePublish", payload: [info] },
          peer
        );
      });
    });

    if (media.kind === "application") {
      this.sendRPC<HandlePublishDone>(
        {
          type: "handlePublishDone",
          payload: [media.info, undefined],
        },
        peer
      );
    } else {
      await this.createOffer(publisherId);
      this.sendRPC<HandlePublishDone>(
        {
          type: "handlePublishDone",
          payload: [media.info, peer.localDescription],
        },
        peer
      );
    }
  };

  unPublish = async (...args: UnPublish["payload"]) => {
    const [info] = args;
    const { subscribers, publisher } = await unPublish(this.room)(info);

    subscribers
      .filter((p) => p.cname !== publisher.cname)
      .forEach((peer) =>
        this.sendRPC<HandleUnPublish>(
          { type: "handleUnPublish", payload: [info, peer.localDescription] },
          peer
        )
      );
    this.sendRPC<HandleUnPublishDone>(
      { type: "handleUnPublishDone", payload: [publisher.localDescription] },
      publisher
    );
  };

  getMedias = (peerId: GetMedias["payload"][0]) => {
    const { peer, infos } = this.room.getMedias(peerId);
    this.sendRPC<HandleMedias>(
      {
        type: "handleMedias",
        payload: [infos],
      },
      peer
    );
  };

  subscribe = async (
    subscriberId: Subscribe["payload"][0],
    requests: Subscribe["payload"][1]
  ) => {
    const { peer, mediaIdPairs } = await subscribe(
      requests,
      subscriberId,
      this.room
    );
    if (mediaIdPairs.find((v) => v.mid)) {
      this.sendRPC<HandleSubscribe>(
        {
          type: "handleSubscribe",
          payload: [mediaIdPairs, peer.localDescription],
        },
        peer
      );
    } else {
      this.sendRPC<HandleSubscribe>(
        {
          type: "handleSubscribe",
          payload: [mediaIdPairs, undefined],
        },
        peer
      );
    }
  };

  unsubscribe = async (...args: UnSubscribe["payload"]) => {
    const peer = await unsubscribe(this.room)(...args);
    this.sendRPC<HandleUnSubscribe>(
      {
        type: "handleUnsubscribe",
        payload: [peer.localDescription],
      },
      peer
    );
  };

  listenMixedAudio = async (...args: ListenMixedAudio["payload"]) => {
    const { peer, meta } = await listenMixedAudio(this.room)(...args);
    this.sendRPC<HandleListenMixedAudio>(
      {
        type: "handleListenMixedAudio",
        payload: [meta, peer.localDescription],
      },
      peer
    );
  };

  addMixedAudioTrack = (...args: AddMixedAudioTrack["payload"]) => {
    addMixedAudioTrack(this.room)(...args);
  };

  removeMixedAudioTrack = (...args: RemoveMixedAudioTrack["payload"]) => {
    removeMixedAudioTrack(this.room)(...args);
  };

  join = (peerId: string) => {
    Object.entries(this.room.peers).forEach(([id, peer]) => {
      if (id === peerId) return;
      this.sendRPC<HandleJoin>({ type: "handleJoin", payload: [peerId] }, peer);
    });
  };

  changeQuality = (...args: ChangeQuality["payload"]) => {
    const [subscriberId, info, type] = args;
    changeQuality(subscriberId, info, type, this.room);
  };

  private async sendRPC<T extends RPC>(msg: T, peer: RTCPeerConnection) {
    const channel = peer.sctpTransport!.channelByLabel("__sfu");
    if (!channel) return;
    await channel.send(JSON.stringify(msg));
  }
}
