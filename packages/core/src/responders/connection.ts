/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  RTCDataChannel,
  RTCIceCandidateJSON,
  RTCPeerConnection,
  RTCSessionDescription,
} from "../../../werift";
import { Room } from "../domains/room";
import {
  AddMixedAudioTrack,
  ChangeQuality,
  GetMedias,
  HandleAnswerDone,
  HandleJoin,
  HandleLeave,
  HandleMedias,
  HandleOffer,
  HandlePublish,
  HandleUnPublish,
  Leave,
  ListenMixedAudio,
  Publish,
  RemoveMixedAudioTrack,
  RPC,
  Subscribe,
  UnPublish,
  HandleSubscribe,
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
        this.leave(peerId);
        peer.close();
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
    const [peers, infos] = await this.room.leave(peerId);
    peers.forEach((peer) =>
      this.sendRPC<HandleLeave>(
        { type: "handleLeave", payload: [infos, peer.localDescription] },
        peer
      )
    );
  };

  publish = async (...args: Publish["payload"]) => {
    const [publisherId, request] = args;

    this.room.publish(publisherId, request).then((responds) => {
      responds.forEach(({ peers, info }) =>
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

    const peer = await this.createOffer(publisherId);
    this.sendRPC<HandleOffer>(
      {
        type: "handleOffer",
        payload: [peer.localDescription],
      },
      peer
    );
  };

  unPublish = async (...args: UnPublish["payload"]) => {
    const [info] = args;

    const { peers, peer } = await this.room.unPublish(info);

    peers.forEach((peer) =>
      this.sendRPC<HandleUnPublish>(
        { type: "handleUnPublish", payload: [info, peer.localDescription] },
        peer
      )
    );
    this.sendRPC<HandleUnPublish>(
      { type: "handleUnPublish", payload: [info, peer.localDescription] },
      peer
    );
  };

  getMedias = (peerId: GetMedias["payload"][0]) => {
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
    subscriberId: Subscribe["payload"][0],
    requests: Subscribe["payload"][1]
  ) => {
    const { peer, meta } = await this.room.subscribe(subscriberId, requests);
    this.sendRPC<HandleSubscribe>(
      {
        type: "handleSubscribe",
        payload: [peer.localDescription, meta],
      },
      peer
    );
  };

  listenMixedAudio = async (...args: ListenMixedAudio["payload"]) => {
    const { peer, meta } = await this.room.listenMixedAudio(...args);
    this.sendRPC<HandleOffer>(
      {
        type: "handleOffer",
        payload: [peer.localDescription, meta],
      },
      peer
    );
  };

  addMixedAudioTrack = (...args: AddMixedAudioTrack["payload"]) => {
    this.room.addMixedAudioTrack(...args);
  };

  removeMixedAudioTrack = (...args: RemoveMixedAudioTrack["payload"]) => {
    this.room.removeMixedAudioTrack(...args);
  };

  join = (peerId: string) => {
    Object.entries(this.room.peers).forEach(([id, peer]) => {
      if (id === peerId) return;
      this.sendRPC<HandleJoin>({ type: "handleJoin", payload: [peerId] }, peer);
    });
  };

  changeQuality = (...args: ChangeQuality["payload"]) => {
    this.room.changeQuality(...args);
  };

  private sendRPC<T extends RPC>(msg: T, peer: RTCPeerConnection) {
    const channel = peer.sctpTransport.channelByLabel("sfu");
    if (!channel) return;
    channel.send(JSON.stringify(msg));
  }
}
