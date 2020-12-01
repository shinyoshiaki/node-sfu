import { RTCPeerConnection } from "../../../werift";
import { Room } from "../domains/room/room";

export async function leave(peerId: string, room: Room) {
  const infos = room.leave(peerId);

  const peers = infos
    .map((info) => {
      const sfu = room.getSFU(info);
      return sfu.stop();
    })
    .flatMap((v) => v)
    .reduce((acc: RTCPeerConnection[], cur) => {
      if (!acc.find((peer) => peer.cname === cur.cname)) acc.push(cur);
      return acc;
    }, []);

  await Promise.all(
    peers.map(async (peer) => peer.setLocalDescription(peer.createOffer()))
  );

  return { peers, infos };
}
