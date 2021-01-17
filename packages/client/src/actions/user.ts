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
) => async (request: {
  track?: MediaStreamTrack;
  simulcast?: boolean;
  kind: Kind;
}) => {
  const publishRequest = {
    kind: request.kind,
    simulcast: !!request.simulcast,
  };
  const [info, offer] = await connection.publish([user.peerId, publishRequest]);

  // todo fix
  if (request.kind !== "application") {
    const peer = await user.publish(request, offer as RTCSessionDescription);
    await connection.sendAnswer(peer.localDescription!);
  }

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
