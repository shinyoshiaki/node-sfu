import { Kind, MediaInfo } from "../";
import { Events } from "../context/events";
import { User } from "../domain/user";
import { Connection } from "../responder/connection";

export const join = (connection: Connection) => async (
  roomName: string,
  peerId: string,
  offer: RTCSessionDescription
) => {
  const user = new User(roomName, connection);
  const { answer, candidates } = await user.join(peerId, offer);
  return { user, answer, candidates };
};

export const publish = (
  connection: Connection,
  user: User,
  events: Events
) => async (requests: { track: MediaStreamTrack; simulcast?: boolean }[]) => {
  const publishRequests = requests.map(({ track, simulcast }) => ({
    kind: track.kind as Kind,
    simulcast: !!simulcast,
  }));
  const [offer, infos] = await connection.publish([
    user.peerId,
    publishRequests,
  ]);

  const answer = await user.publish(requests, offer as any);
  await connection.sendAnswer(answer);

  user.published = [...user.published, ...infos];
  infos.forEach((info) => events.onPublish.execute(info));
};

export const unPublish = (
  connection: Connection,
  user: User,
  events: Events
) => async (info: MediaInfo) => {
  if (info.publisherId !== connection.peerId) return;

  user.published = user.published.filter((v) => v.mediaId !== info.mediaId);
  events.onUnPublish.execute(info);

  await connection.unPublish([info]);
};
