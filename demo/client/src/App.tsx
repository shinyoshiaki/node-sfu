import React, { FC, useEffect, useRef, useState } from "react";
import { RTCManager } from "./rtc";

const App: FC = () => {
  const rtcManagerRef = useRef<RTCManager>();

  useEffect(() => {
    const rtcManager = (rtcManagerRef.current = new RTCManager());
    rtcManager.join();
  }, []);
  return <div></div>;
};

export default App;
