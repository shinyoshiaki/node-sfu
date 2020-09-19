import React, { FC, useEffect, useRef, useState } from "react";
import { RTCManager } from "./rtc";

const App: FC = () => {
  const rtcManagerRef = useRef<RTCManager>();
  const videos = useRef<HTMLVideoElement[]>([]);
  const [streams, setStreams] = useState<MediaStream[]>([]);

  useEffect(() => {
    const rtcManager = (rtcManagerRef.current = new RTCManager());
    (async () => {
      await rtcManager.join();

      rtcManager.peer!.ontrack = (e) => {
        const stream = e.streams[0];
        console.log("track", stream.id);
        stream.onremovetrack = () => {
          setStreams((streams) => streams.filter((s) => stream.id !== s.id));
        };
        setStreams((streams) => [...streams, stream]);
      };
      rtcManager.onPublish.subscribe((info) => {
        if (info.peerId !== rtcManager.peerId) {
          rtcManager.subscribe([info]);
        }
      });

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      await rtcManager.publish(mediaStream.getTracks());
      const infos = await rtcManager.getTracks();
      await rtcManager.subscribe(infos);
    })();
  }, []);

  React.useEffect(() => {
    videos.current.forEach((v, i) => {
      if (streams[i]) v.srcObject = streams[i];
    });
  }, [streams]);

  return (
    <div>
      <div style={{ display: "flex", width: "100%" }}>
        {streams.map((_, i) => (
          <div key={i}>
            <video
              ref={(ref) => {
                const arr = videos.current;
                arr[i] = ref!;
                videos.current = arr;
              }}
              autoPlay
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
