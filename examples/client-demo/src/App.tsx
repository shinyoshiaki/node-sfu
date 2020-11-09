import React, { FC, useEffect, useRef, useState } from "react";
import type { MediaInfo, SubscriberType } from "../../../packages/core/src";
import { RTCManager } from "../../../packages/client/src";

const endpointURL = (() => {
  //@ts-ignore
  console.log(NODE_ENV);
  //@ts-ignore
  switch (NODE_ENV || "") {
    case "dev":
      return "http://localhost:12222";
    default:
      return "https://node-sfu.tk";
  }
})();

const App: FC = () => {
  const rtcManagerRef = useRef<RTCManager>();
  const videos = useRef<HTMLVideoElement[]>([]);
  const [streams, setStreams] = useState<
    { stream: MediaStream; info: MediaInfo }[]
  >([]);

  const init = async (rtcManager: RTCManager) => {
    const params = new URLSearchParams(window.location.hash.split("#")[1]);

    if (!params.has("room")) {
      await rtcManager.create();
      window.location.hash = `?room=${rtcManager.roomName}`;
    } else rtcManager.roomName = params.get("room")!;

    console.log("roomName", rtcManager.roomName);

    await rtcManager.join();

    rtcManager.onPublish.subscribe((info) => {
      if (info.publisherId !== rtcManager.peerId) {
        rtcManager.subscribe([info]);
      }
    });
    rtcManager.onTrack.subscribe((stream, info) => {
      stream.onremovetrack = () => {
        setStreams((streams) =>
          streams.filter(({ stream: s }) => stream.id !== s.id)
        );
      };

      setStreams((streams) => [...streams, { stream, info }]);
    });

    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    await rtcManager.publish([
      { track: mediaStream.getVideoTracks()[0], simulcast: true },
    ]);
    console.log("published");
    const infos = await rtcManager.getTracks();
    await rtcManager.subscribe(infos);
    console.log("joined");
  };

  const changeQuality = (info: MediaInfo, type: SubscriberType) => {
    const manager = rtcManagerRef.current!;
    manager.changeQuality(info, type);
  };

  useEffect(() => {
    const rtcManager = rtcManagerRef.current;

    if (!rtcManager) {
      rtcManagerRef.current = new RTCManager(endpointURL);
      init(rtcManagerRef.current);
      return;
    }
  }, [streams, rtcManagerRef]);

  useEffect(() => {
    videos.current.forEach((v, i) => {
      if (streams[i]) v.srcObject = streams[i].stream;
    });
  }, [streams]);

  return (
    <div>
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
