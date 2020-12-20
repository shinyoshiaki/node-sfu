import {
  ChangeEvent,
  FC,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Context } from ".";
import { MediaInfo } from "../../../packages/client/src";

const App: FC = () => {
  const clientSDK = useContext(Context);
  const audioRef = useRef<HTMLAudioElement>();

  const [infos, setInfos] = useState<MediaInfo[]>([]);
  const [listens, setListens] = useState<MediaInfo[]>([]);

  const init = async () => {
    const audio = audioRef.current;
    const params = new URLSearchParams(window.location.hash.split("#")[1]);

    if (!params.has("room")) {
      await clientSDK.apiCreate();
      window.location.hash = `?room=${clientSDK.roomName}`;
    } else clientSDK.roomName = params.get("room")!;

    console.log("roomName", clientSDK.roomName);

    await clientSDK.apiJoin();

    clientSDK.events.onTrack.subscribe((stream) => {
      console.log("onTrack", { stream });
      audio.srcObject = stream;
    });

    const infos = (await clientSDK.getMedias()).filter(
      (info) => info.publisherId !== clientSDK.peerId && info.kind === "audio"
    );
    setInfos(infos);

    console.log("joined");
  };

  const listen = () => {
    clientSDK.events.onPublish.subscribe((info) => {
      console.log("onPublish", info);
      if (info.publisherId === clientSDK.peerId) return;
      if (info.kind === "audio") {
        setInfos((prev) => [...prev, info]);
      }
    });
    clientSDK.events.onUnPublish.subscribe((info) => {
      setInfos((prev) => prev.filter((v) => v.mediaId !== info.mediaId));
    });
  };

  useEffect(() => {
    init();
    listen();
  }, []);

  const publishVoice = async () => {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    await clientSDK.publish({ track: mediaStream.getTracks()[0] });
  };

  async function getAudioStream(ab: ArrayBuffer, gain: number) {
    const ctx = new AudioContext();

    const audioBuffer = await ctx.decodeAudioData(ab);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.loop = true;
    source.start();
    const gainNode = ctx.createGain();
    source.connect(gainNode);
    gainNode.gain.value = gain;
    const destination = ctx.createMediaStreamDestination();
    gainNode.connect(destination);
    source.connect(destination);

    return destination.stream;
  }

  const publishFile = async ({
    target: { files },
  }: ChangeEvent<HTMLInputElement>) => {
    const file = files[0];
    const stream = await getAudioStream(await file.arrayBuffer(), 0.1);
    await clientSDK.publish({ track: stream.getTracks()[0] });
  };

  const addAudio = async (info: MediaInfo) => {
    if (clientSDK.mcu.mixers.length === 0) {
      await clientSDK.listenMixedAudio([info]);
    } else {
      clientSDK.addMixedAudioTrack(clientSDK.mcu.mixers[0].id, info);
    }

    setListens((prev) => [...prev, info]);
  };

  const removeAudio = (info: MediaInfo) => {
    const mixId = clientSDK.mcu.mixers[0].id;
    clientSDK.removeMixedAudioTrack(mixId, info);
    setListens((prev) => prev.filter((v) => v.mediaId !== info.mediaId));
  };

  return (
    <div>
      <audio ref={audioRef} controls />
      <button onClick={publishVoice}>publish voice</button>
      <input type="file" onChange={publishFile} />
      <div>
        <p>listened</p>
        {listens.map((info, i) => (
          <div key={i}>
            {info.mediaId}
            <button onClick={() => removeAudio(info)}>remove audio</button>
          </div>
        ))}
      </div>
      <div>
        <p>published</p>
        {infos.map((info, i) => (
          <div key={i}>
            {info.mediaId}
            <button onClick={() => addAudio(info)}>add audio</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
