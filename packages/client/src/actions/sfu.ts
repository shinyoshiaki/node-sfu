import { MediaInfo, RequestSubscribe } from "../";
import { SFUManager } from "../domain/sfu/manager";
import { Connection } from "../responder/connection";

export const subscribe = (connection: Connection, sfu: SFUManager) => async (
  infos: MediaInfo[]
) => {
  if (sfu.isSubscribed(infos)) return;

  const requests: RequestSubscribe[] = infos.map((info) => {
    if (info.kind === "application") {
      return { info };
    } else {
      const type = info.simulcast ? "high" : "single";
      return { info, type };
    }
  });
  const [mediaIdPairs, offer] = await connection.subscribe([
    connection.peerId,
    requests,
  ]);

  const mediaMap = (
    await Promise.all(
      mediaIdPairs.map(async ({ label, mediaId, mid }) => {
        if (label) {
          const [dc] =
            [connection.datachannels[label]] ||
            (await connection.ondatachannel.watch((dc) => dc.label === label));
          return { dc, mediaId };
        } else {
          return { mid, mediaId };
        }
      })
    )
  ).reduce(
    (
      acc: {
        [mediaId: string]: Partial<{ dc: RTCDataChannel; mid: string }>;
      },
      cur
    ) => {
      if (cur.dc) acc[cur.mediaId] = { dc: cur.dc };
      else acc[cur.mediaId] = { mid: cur.mid };
      return acc;
    },
    {}
  );

  const consumers = sfu.subscribe(infos, mediaMap);

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
