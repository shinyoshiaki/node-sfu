import { FC, useContext, useEffect, useRef, useState } from "react";
import { Context } from ".";
import { MediaInfo, SubscriberType } from "../../../packages/client/src";

const App: FC = () => {
  const client = useContext(Context);
  const videos = useRef<HTMLVideoElement[]>([]);
  const [streams, setStreams] = useState<
    { stream: MediaStream; info: MediaInfo }[]
  >([]);

  const init = async () => {
    const params = new URLSearchParams(window.location.hash.split("#")[1]);

    if (!params.has("room")) {
      await client.apiCreate();
      window.location.hash = `?room=${client.roomName}`;
    } else client.roomName = params.get("room")!;

    console.log("roomName", client.roomName);

    client.apiJoin();
    await client.events.onConnect.asPromise();

    client.events.onPublish.subscribe((info) => {
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

    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: true,
    });

    await client.publish([
      { track: mediaStream.getVideoTracks()[0], simulcast: true },
    ]);
    console.log("published");
    const infos = await client.getMedias();
    await client.subscribe(infos);
    console.log("joined");
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

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", width: "100%" }}>
        {streams.map(({ info }, i) => (
          <div key={i}>
            <p>{`${info.mediaId} ${info.publisherId}`}</p>
            <button onClick={() => changeQuality(info, "low")}>low</button>
            <button onClick={() => changeQuality(info, "high")}>high</button>
            <button onClick={() => changeQuality(info, "auto")}>auto</button>
            <button onClick={() => client.unPublish(info)}>un publish</button>
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
