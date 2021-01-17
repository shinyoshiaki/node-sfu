import { Kind } from "../../../werift/webrtc/src";
import { MediaInfo } from "../domains/media/media";
import { Room } from "../domains/room";
import { SubscriberType } from "../domains/sfu/subscriber";
import { RequestSubscribe } from "../typings/rpc";

export async function subscribe(
  requests: RequestSubscribe[],
  subscriberId: string,
  room: Room
) {
  const peer = room.peers[subscriberId];

  const pairs = requests.map(({ info, type }) => {
    const { mediaId, kind } = info;

    const sfu = room.getSFU(info);
    if (kind === "application") {
      sfu.subscribeData(subscriberId, peer);
      return { mediaId };
    } else {
      const transceiver = peer.addTransceiver(kind as Kind, "sendonly");
      sfu.subscribeAV(subscriberId, peer, transceiver, type);
      return { mediaId, uuid: transceiver.uuid };
    }
  });

  if (requests.find((req) => req.info.kind !== "application")) {
    await peer.setLocalDescription(peer.createOffer());
  }

  const meta = pairs
    .map(({ mediaId, uuid }) => {
      if (!uuid) return;
      const transceiver = peer.transceivers.find((t) => t.uuid === uuid);
      return { mediaId, mid: transceiver.mid };
    })
    .filter((v) => v);

  return { peer, meta };
}

export const unsubscribe = (room: Room) => async (
  info: MediaInfo,
  subscriberId: string
) => {
  const peer = room.peers[subscriberId];
  const sender = room.getSFU(info).unsubscribe(subscriberId);
  peer.removeTrack(sender);
  await peer.setLocalDescription(peer.createOffer());
  return peer;
};

export function changeQuality(
  subscriberId: string,
  info: MediaInfo,
  type: SubscriberType,
  room: Room
) {
  const sfu = room.getSFU(info);
  sfu.changeQuality(subscriberId, type);
}
