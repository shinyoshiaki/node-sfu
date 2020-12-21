import { MediaInfo, RequestSubscribe } from "../";
import { SFUManager } from "../domain/sfu/manager";
import { Connection } from "../responder/connection";

export const subscribe = (connection: Connection, sfu: SFUManager) => async (
  infos: MediaInfo[]
) => {
  if (sfu.isSubscribed(infos)) return;

  const requests: RequestSubscribe[] = infos.map((info) => {
    return {
      info,
      type: info.simulcast ? "high" : "single",
    };
  });
  const [offer, pairs] = await connection.subscribe([
    connection.peerId,
    requests,
  ]);
  sfu.subscribe(pairs, infos);
  const answer = await connection.setOffer(offer as any);
  await connection.sendAnswer(answer);
};

export const unsubscribe = (connection: Connection, sfu: SFUManager) => async (
  info: MediaInfo
) => {
  const [offer] = await connection.unsubscribe([info, connection.peerId]);
  sfu.unsubscribe(info);
  const answer = await connection.setOffer(offer as any);
  await connection.sendAnswer(answer);
};
