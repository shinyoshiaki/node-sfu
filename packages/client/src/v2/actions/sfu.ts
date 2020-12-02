import { Connection } from "../responder/connection";
import { MediaInfo, RequestSubscribe } from "../../";
import { SFUManager } from "../domain/sfu/manager";

export const subscribe = (connection: Connection, sfu: SFUManager) => async (
  infos: MediaInfo[]
) => {
  const requests: RequestSubscribe[] = infos.map((info) => {
    return {
      info,
      type: info.kind === "audio" ? "single" : "high",
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
