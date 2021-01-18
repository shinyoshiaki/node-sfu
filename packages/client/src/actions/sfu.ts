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

  let datachannel: RTCDataChannel | undefined =
    connection.datachannels["messaging"];

  const dcExist = infos.find((info) => info.kind === "application");
  if (dcExist && !datachannel) {
    [datachannel] = await connection.ondatachannel.watch(
      (dc) => dc.label === "messaging"
    );
  }
  sfu.subscribe(infos, midPairs, datachannel);

  if (offer) {
    const answer = await connection.setOffer(offer as any);
    await connection.sendAnswer(answer);
  }
};

export const unsubscribe = (connection: Connection, sfu: SFUManager) => async (
  info: MediaInfo
) => {
  const [offer] = await connection.unsubscribe([info, connection.peerId]);
  sfu.unsubscribe(info);
  const answer = await connection.setOffer(offer as any);
  await connection.sendAnswer(answer);
};
