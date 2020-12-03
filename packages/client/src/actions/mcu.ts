import { MediaInfo } from "../";
import { MCUManager } from "../domain/mcu/manager";
import { Connection } from "../responder/connection";

export const listenMixedAudio = (
  connection: Connection,
  mcuManager: MCUManager
) => async (infos: MediaInfo[]) => {
  const [offer, meta] = await connection.listenMixedAudio([
    connection.peerId,
    infos,
  ]);
  const mcu = mcuManager.listen(meta.mixId, meta.mid, infos);
  const answer = await connection.setOffer(offer as any);
  await connection.sendAnswer(answer);
  return mcu;
};
