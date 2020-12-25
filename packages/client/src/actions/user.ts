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
) => async (request: { track: MediaStreamTrack; simulcast?: boolean }) => {
  const publishRequest = {
    kind: request.track.kind as Kind,
    simulcast: !!request.simulcast,
  };
  const [offer, info] = await connection.publish([user.peerId, publishRequest]);

  const answer = await user.publish(request, offer as any);
  await connection.sendAnswer(answer);

  user.published = [...user.published, info];
  events.onPublish.execute(info);
  return info;
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
