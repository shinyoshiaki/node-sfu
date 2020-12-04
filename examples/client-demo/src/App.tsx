import { FC, useContext, useEffect, useRef, useState } from "react";
import { Context } from ".";
import { MediaInfo, SubscriberType } from "../../../packages/client/src";

const App: FC = () => {
  const client = useContext(Context);
  const videos = useRef<HTMLVideoElement[]>([]);
  const [streams, setStreams] = useState<
    { stream: MediaStream; info: MediaInfo }[]
  >([]);
  const [published, setPublished] = useState<MediaInfo[]>([]);
  const init = async () => {
    const params = new URLSearchParams(window.location.hash.split("#")[1]);

    if (!params.has("room")) {
      await client.apiCreate();
      window.location.hash = `?room=${client.roomName}`;
    } else client.roomName = params.get("room")!;

    console.log("roomName", client.roomName);

    client.apiJoin();
    await client.events.onConnect.asPromise();

    listen();
    await publish();
    const infos = await client.getMedias();
    await client.subscribe(infos);
  };

  const listen = () => {
    client.events.onPublish.subscribe((info) => {
      client.publish;
      if (info.publisherId !== client.peerId) {
        console.log(info, client.peerId);
        client.subscribe([info]);
      }
    });
    client.events.onTrack.subscribe((stream, info) => {
      stream.onremovetrack = () => {
        setStreams((streams) =>
          streams.filter(({ stream: s }) => stream.id !== s.id)
        );
      };
      setStreams((streams) => [...streams, { stream, info }]);
    });
    client.events.onJoin.subscribe((peerId) => {
      console.log("join", peerId);
    });
    client.events.onPublish.subscribe(() =>
      setPublished(client.user.published)
    );
    client.events.onUnPublish.subscribe(() =>
      setPublished(client.user.published)
    );
  };

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    videos.current.forEach((v, i) => {
      if (streams[i]) v.srcObject = streams[i].stream;
    });
  }, [streams]);

  const changeQuality = (info: MediaInfo, type: SubscriberType) => {
    client.changeQuality(info, type);
  };

  const publish = async () => {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: true,
    });

    await client.publish([
      { track: mediaStream.getTracks()[0], simulcast: true },
    ]);
  };

  return (
    <div>
      <button onClick={publish}>publish</button>
      <p>published</p>
      <div style={{ display: "flex" }}>
        {published.map((info, i) => (
          <span key={i}>
            <div>{JSON.stringify(info)}</div>
            <button onClick={() => client.unPublish(info)}>un publish</button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", width: "100%" }}>
        {streams.map(({ info }, i) => (
          <div key={i}>
            <p>{`${info.mediaId} ${info.publisherId}`}</p>
            <button onClick={() => changeQuality(info, "low")}>low</button>
            <button onClick={() => changeQuality(info, "high")}>high</button>
            <button onClick={() => changeQuality(info, "auto")}>auto</button>
            <br />
            <video
              ref={(ref) => {
                const arr = videos.current;
                arr[i] = ref!;
                videos.current = arr;
              }}
              autoPlay
              style={{ background: "black" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
