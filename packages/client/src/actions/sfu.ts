import { MediaInfo, RequestSubscribe } from "../";
import { SFUManager } from "../domain/sfu/manager";
import { Connection } from "../responder/connection";

export const subscribe = (connection: Connection, sfu: SFUManager) => async (
  infos: MediaInfo[]
) => {
  if (sfu.isSubscribed(infos)) return;

  const requests: RequestSubscribe[] = infos.map((info) => {
    if (info.kind === "application") {
      return {
        info,
      };
    } else {
      return {
        info,
        type: info.simulcast ? "high" : "single",
      };
    }
  });
  const [midPairs, offer] = await connection.subscribe([
    connection.peerId,
    requests,
  ]);

  const dcPairs = await Promise.all(
    infos
      .filter((v) => v.kind === "application")
      .map(async (v) => {
        const label = `__messaging:${v.mediaId}`;
        let dc = connection.datachannels[label];
        if (!dc) {
          [dc] = await connection.ondatachannel.watch(
            (dc) => dc.label === label
          );
        }
        return { dc, mediaId: v.mediaId };
      })
  );

  const consumers = sfu.subscribe(infos, midPairs, dcPairs);

  if (offer) {
    const answer = await connection.setOffer(offer as any);
    await connection.sendAnswer(answer);
  }

  return consumers;
};

export const unsubscribe = (connection: Connection, sfu: SFUManager) => async (
  info: MediaInfo
) => {
  const [offer] = await connection.unsubscribe([info, connection.peerId]);
  sfu.unsubscribe(info);
  const answer = await connection.setOffer(offer as any);
  await connection.sendAnswer(answer);
};
