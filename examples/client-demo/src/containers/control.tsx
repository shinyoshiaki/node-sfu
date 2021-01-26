import { FC, useContext } from "react";
import { Button, Stack } from "@chakra-ui/react";
import { ClientContext } from "..";
import { Selector } from "../components/selector";
import { FilePicker } from "../components/input";
import { getAudioStream } from "../util";
import { Kind } from "../../../../packages/core/src";

export const Control: FC = () => {
  const client = useContext(ClientContext);

  const publishMedia = async (
    simulcast: boolean,
    constraints: MediaStreamConstraints
  ) => {
    const [track] = (
      await navigator.mediaDevices.getUserMedia(constraints)
    ).getTracks();
    await client.publish({ track, simulcast, kind: track.kind as Kind });
  };

  const publishDisplay = async (simulcast: boolean) => {
    const [track] = (
      await (navigator.mediaDevices as any).getDisplayMedia()
    ).getTracks();
    await client.publish({ track, simulcast, kind: track.kind as Kind });
  };

  const publishFile = async (file: File) => {
    const stream = await getAudioStream(await file.arrayBuffer(), 0.1);
    const [track] = stream.getTracks();
    await client.publish({ track, kind: track.kind as Kind });
  };

  const publishDataChannel = async () => {
    await client.publish({ kind: "application" });
  };

  const createMixer = () => {
    client.listenMixedAudio([]);
  };

  return (
    <Stack direction="row" flexWrap="wrap">
      <Selector
        button="publish camera"
        onClick={(res) => publishMedia(res, { video: true })}
      />
      <Selector
        button="publish display"
        onClick={(res) => publishDisplay(res)}
      />
      <FilePicker onSelect={publishFile} top={1}>
        publish file
      </FilePicker>
      <Button onClick={() => publishMedia(false, { audio: true })} top={1}>
        publish audio
      </Button>
      <Button onClick={publishDataChannel} top={1}>
        publish datachannel
      </Button>
      <Button onClick={createMixer} top={1}>
        create Mixer
      </Button>
    </Stack>
  );
};
