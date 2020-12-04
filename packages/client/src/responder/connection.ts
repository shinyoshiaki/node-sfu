import Event from "rx.mini";
import {
  AddMixedAudioTrack,
  ChangeQuality,
  GetMedias,
  HandleAnswer,
  HandleCandidate,
  HandleJoin,
  HandleLeave,
  HandleListenMixedAudio,
  HandleMedias,
  HandlePublish,
  HandlePublishDone,
  HandleSubscribe,
  HandleUnPublish,
  HandleUnPublishDone,
  ListenMixedAudio,
  Publish,
  RemoveMixedAudioTrack,
  RPC,
  Subscribe,
  UnPublish,
} from "../";
import { Events } from "../context/events";

export class Connection {
  private channel!: RTCDataChannel;
  private readonly onmessage = new Event<[string]>();

  readonly ontrack = new Event<[RTCTrackEvent]>();
  readonly peer: RTCPeerConnection = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });
  peerId!: string;

  constructor(private events: Events) {
    this.peer.ondatachannel = ({ channel }) => {
      this.channel = channel;
      events.onConnect.execute();
      this.peer.onicecandidate = ({ candidate }) => {
        if (candidate) this.sendCandidate(candidate);
      };
      channel.onmessage = ({ data }) => {
        this.onmessage.execute(data);
      };
    };
    this.peer.ontrack = (ev) => this.ontrack.execute(ev);
    this.onmessage.subscribe((data) => {
      const { type, payload } = JSON.parse(data) as RPC;
      console.log("from sfu", type, payload);
      //@ts-ignore
      if (this[type]) {
        //@ts-ignore
        this[type](...payload);
      }
    });
  }

  private handleLeave = async (...args: HandleLeave["payload"]) => {
    const [infos, offer] = args;
    this.events.onLeave.execute(infos);
    const answer = await this.setOffer(offer as any);
    this.sendAnswer(answer);
  };

  private handleJoin = async (...args: HandleJoin["payload"]) => {
    const [peerId] = args;
    this.events.onJoin.execute(peerId);
  };

  private handlePublish = (...args: HandlePublish["payload"]) => {
    const [infos] = args;
    infos.forEach((info) => this.events.onPublish.execute(info));
  };

  private handleUnPublish = async (...args: HandleUnPublish["payload"]) => {
    const [info, offer] = args;
    this.events.onUnPublish.execute(info);
    const answer = await this.setOffer(offer as any);
    await this.sendAnswer(answer);
  };

  async setOffer(offer: RTCSessionDescription) {
    await this.peer.setRemoteDescription(offer);
    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(answer);
    return this.peer.localDescription;
  }

  sendCandidate = (candidate: RTCIceCandidate) => {
    this.sendRPC<HandleCandidate>({
      type: "handleCandidate",
      payload: [this.peerId, candidate as any],
    });
  };

  sendAnswer = async (answer: RTCSessionDescription) => {
    this.sendRPC<HandleAnswer>({
      type: "handleAnswer",
      payload: [this.peerId, answer as any],
    });
    await this.waitRPC("handleAnswerDone");
  };

  publish = async (payload: Publish["payload"]) => {
    this.sendRPC<Publish>({
      type: "publish",
      payload,
    });
    return this.waitRPC<HandlePublishDone>("handlePublishDone");
  };

  unPublish = async (payload: UnPublish["payload"]) => {
    this.sendRPC<UnPublish>({
      type: "unPublish",
      payload,
    });
    const [offer] = await this.waitRPC<HandleUnPublishDone>(
      "handleUnPublishDone"
    );
    const answer = await this.setOffer(offer as any);
    await this.sendAnswer(answer);
  };

  subscribe = async (payload: Subscribe["payload"]) => {
    this.sendRPC<Subscribe>({
      type: "subscribe",
      payload,
    });
    return await this.waitRPC<HandleSubscribe>("handleSubscribe");
  };

  getMedias = async () => {
    this.sendRPC<GetMedias>({
      type: "getMedias",
      payload: [this.peerId],
    });
    const [infos] = await this.waitRPC<HandleMedias>("handleMedias");

    return infos;
  };

  changeQuality = (payload: ChangeQuality["payload"]) => {
    this.sendRPC<ChangeQuality>({
      type: "changeQuality",
      payload,
    });
  };

  listenMixedAudio = async (payload: ListenMixedAudio["payload"]) => {
    this.sendRPC<ListenMixedAudio>({
      type: "listenMixedAudio",
      payload,
    });
    return await this.waitRPC<HandleListenMixedAudio>("handleListenMixedAudio");
  };

  addMixedAudioTrack(payload: AddMixedAudioTrack["payload"]) {
    this.sendRPC<AddMixedAudioTrack>({
      type: "addMixedAudioTrack",
      payload,
    });
  }

  removeMixedAudioTrack(payload: RemoveMixedAudioTrack["payload"]) {
    this.sendRPC<RemoveMixedAudioTrack>({
      type: "removeMixedAudioTrack",
      payload,
    });
  }

  private waitRPC = <T extends RPC>(target: T["type"]) =>
    new Promise<T["payload"]>((r) => {
      const { unSubscribe } = this.onmessage.subscribe((data) => {
        const { type, payload } = JSON.parse(data) as RPC;
        if (type === target) {
          unSubscribe();
          r(payload);
        }
      });
    });

  private sendRPC<T extends RPC>(msg: T) {
    console.log("sendRPC", msg);
    this.channel.send(JSON.stringify(msg));
  }
}
