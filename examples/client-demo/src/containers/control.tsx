import { FC, useContext } from "react";
import { Box, Button, Flex, Stack, Badge } from "@chakra-ui/react";
import { ClientContext } from "..";
import { Selector } from "../components/selector";

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

  return (
    <Stack direction="row">
      <Selector
        button="publish camera"
        onClick={(res) => publishMedia(res, { video: true })}
      />
      <Button onClick={() => publishMedia(false, { audio: true })} top={1}>
        publish audio
      </Button>
      <Selector
        button="publish display"
        onClick={(res) => publishDisplay(res)}
      />
    </Stack>
  );
};
