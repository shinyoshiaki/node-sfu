import React, { FC, useEffect, useRef, useState } from "react";
import { RTCManager } from "./rtc";

const App: FC = () => {
  const rtcManagerRef = useRef<RTCManager>();

  useEffect(() => {
    const rtcManager = (rtcManagerRef.current = new RTCManager());
    (async () => {
      await rtcManager.join();
      const tracks = (
        await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })
      ).getTracks();
      await rtcManager.publish(tracks);
      await rtcManager.getTracks();
    })();
  }, []);
  return <div></div>;
};

export default App;
