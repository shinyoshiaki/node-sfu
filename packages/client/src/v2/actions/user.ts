import { User } from "../domain/user";
import { Connection } from "../responder/connection";
import { Kind } from "../../";

export const join = (connection: Connection) => async (
  roomName: string,
  peerId: string,
  offer: RTCSessionDescription
) => {
  const user = new User(roomName, connection);
  const { answer, candidates } = await user.join(peerId, offer);
  return { user, answer, candidates };
};

export const publish = (connection: Connection, user: User) => async (
  requests: { track: MediaStreamTrack; simulcast?: boolean }[]
) => {
  const publishRequests = requests.map(({ track, simulcast }) => ({
    kind: track.kind as Kind,
    simulcast: !!simulcast,
  }));
  const offer = await connection.publish([user.peerId, publishRequests]);
  const answer = await user.publish(requests, offer as any);
  await connection.sendAnswer(answer);
};
