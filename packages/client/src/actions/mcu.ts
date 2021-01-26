import { MediaInfo } from "../";
import { Events } from "../context/events";
import { MCUManager } from "../domain/mcu/manager";
import { Connection } from "../responder/connection";

export const listenMixedAudio = (
  connection: Connection,
  mcuManager: MCUManager,
  events: Events
) => async (infos: MediaInfo[]) => {
  const [meta, offer] = await connection.listenMixedAudio([
    connection.peerId,
    infos,
  ]);
  const mcu = mcuManager.listen(meta.mixId, meta.mid!, infos);
  const answer = await connection.setOffer(offer as any);
  await connection.sendAnswer(answer);
  events.onMixerCreated.execute(mcu);
  return mcu;
};
