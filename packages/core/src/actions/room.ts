import { RTCPeerConnection } from "../../../werift";
import { MediaInfo } from "../domains/room/media/media";
import { Room } from "../domains/room/room";

export async function leave(peerId: string, room: Room) {
  const infos = room.leave(peerId);

  const peers = (
    await Promise.all(
      infos.map((info) => {
        const sfu = room.getSFU(info);
        return sfu.stop();
      })
    )
  )
    .flatMap((v) => v)
    .reduce((acc: RTCPeerConnection[], cur) => {
      if (!acc.find((peer) => peer.cname === cur.cname)) acc.push(cur);
      return acc;
    }, []);

  return { peers, infos };
}

export const unPublish = (room: Room) => async (info: MediaInfo) => {
  const publisher = await room.unPublish(info);
  const sfu = room.getSFU(info);
  const subscribers = await sfu.stop();

  return { subscribers, publisher };
};
