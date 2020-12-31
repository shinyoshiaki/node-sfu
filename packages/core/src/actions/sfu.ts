import { Kind } from "../../../werift/webrtc/src";
import { MediaInfo } from "../domains/media/media";
import { Room } from "../domains/room";
import { SubscriberType } from "../domains/sfu/subscriber";

export async function subscribe(
  requests: { info: MediaInfo; type: SubscriberType }[],
  subscriberId: string,
  room: Room
) {
  const peer = room.peers[subscriberId];

  const pairs = requests.map(({ info, type }) => {
    const { mediaId, kind } = info;
    const transceiver = peer.addTransceiver(kind as Kind, "sendonly");

    const sfu = room.getSFU(info);
    sfu.subscribe(subscriberId, peer, transceiver, type);

    return { mediaId, uuid: transceiver.uuid };
  });

  await peer.setLocalDescription(peer.createOffer());

  const meta = pairs.map(({ mediaId, uuid }) => {
    const transceiver = peer.transceivers.find((t) => t.uuid === uuid);
    return { mediaId, mid: transceiver.mid };
  });
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
