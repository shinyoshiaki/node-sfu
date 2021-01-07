import { FC, useContext } from "react";
import { Button, Stack } from "@chakra-ui/react";
import { ClientContext } from "..";
import { Selector } from "../components/selector";
import { FilePicker } from "../components/input";
import { getAudioStream } from "../util";

export const Control: FC = () => {
  const client = useContext(ClientContext);

  const publishMedia = async (
    simulcast: boolean,
    constraints: MediaStreamConstraints
  ) => {
    const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    await client.publish({ track: mediaStream.getTracks()[0], simulcast });
  };

  const publishDisplay = async (simulcast: boolean) => {
    const mediaStream = await (navigator.mediaDevices as any).getDisplayMedia();
    await client.publish({ track: mediaStream.getTracks()[0], simulcast });
  };

  const publishFile = async (file: File) => {
    const stream = await getAudioStream(await file.arrayBuffer(), 0.1);
    await client.publish({ track: stream.getTracks()[0] });
  };

  return (
    <Stack direction="row">
      <Selector
        button="publish camera"
        onClick={(res) => publishMedia(res, { video: true })}
      />
      <Button onClick={() => publishMedia(false, { audio: true })} top={1}>
        publish audio
      </Button>
      <FilePicker onSelect={publishFile} top={1}>
        publish file
      </FilePicker>
      <Selector
        button="publish display"
        onClick={(res) => publishDisplay(res)}
      />
    </Stack>
  );
};
