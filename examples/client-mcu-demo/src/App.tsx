import React, { FC, useContext, useEffect, useRef } from "react";
import { Context } from ".";

const App: FC = () => {
  const clientSDK = useContext(Context);
  const audioRef = useRef<HTMLAudioElement>();

  const init = async () => {
    const audio = audioRef.current;
    const params = new URLSearchParams(window.location.hash.split("#")[1]);

    if (!params.has("room")) {
      await clientSDK.create();
      window.location.hash = `?room=${clientSDK.roomName}`;
    } else clientSDK.roomName = params.get("room")!;

    console.log("roomName", clientSDK.roomName);

    await clientSDK.join();

    clientSDK.onTrack.subscribe((stream) => {
      console.log("onTrack", { stream });
      audio.srcObject = stream;
    });

    const mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    await clientSDK.publish([{ track: mediaStream.getTracks()[0] }]);
    console.log("published");
    const infos = (await clientSDK.getTracks()).filter(
      (info) => info.publisherId !== clientSDK.peerId
    );
    console.log({ infos });
    if (infos.length > 0) await clientSDK.listenMixedAudio(infos);
    console.log("joined");
  };

  useEffect(() => {
    init();
  }, []);

  return (
    <div>
      <audio ref={audioRef} controls />
    </div>
  );
};

export default App;
