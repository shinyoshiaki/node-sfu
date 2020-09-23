import React, { FC, useEffect, useRef, useState } from "react";
import { RTCManager } from "./rtc";

const App: FC = () => {
  const rtcManagerRef = useRef<RTCManager>();
  const videos = useRef<HTMLVideoElement[]>([]);
  const [streams, setStreams] = useState<MediaStream[]>([]);

  const init = async (rtcManager: RTCManager) => {
    await rtcManager.join();

    rtcManager.onPublish.subscribe((info) => {
      if (info.publisherId !== rtcManager.peerId) {
        rtcManager.subscribe([info]);
      }
    });
    rtcManager.peer!.ontrack = (e) => {
      const stream = e.streams[0];
      console.log("track", e.track);
      console.log("track", stream.id);
      stream.onremovetrack = () => {
        setStreams((streams) => streams.filter((s) => stream.id !== s.id));
      };
      setStreams((streams) => [...streams, stream]);
    };

    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    await rtcManager.publish(mediaStream.getTracks(), true);
    console.log("published");
    const infos = await rtcManager.getTracks();
    await rtcManager.subscribe(infos);
    console.log("joined");
  };

  useEffect(() => {
    const rtcManager = rtcManagerRef.current;

    if (!rtcManager) {
      rtcManagerRef.current = new RTCManager("https://node-sfu.tk");
      init(rtcManagerRef.current);
      return;
    }
  }, [streams, rtcManagerRef]);

  useEffect(() => {
    videos.current.forEach((v, i) => {
      if (streams[i]) v.srcObject = streams[i];
    });
  }, [streams]);

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", width: "100%" }}>
        {streams.map((_, i) => (
          <div key={i}>
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
