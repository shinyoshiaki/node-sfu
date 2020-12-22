import { FC, useContext } from "react";
import { Box, Button, Flex, Stack, Badge } from "@chakra-ui/react";
import { ClientContext } from "..";

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
      <Button onClick={() => publishMedia(true, { video: true })}>
        publish simulcast
      </Button>
      <Button onClick={() => publishMedia(false, { video: true })}>
        publish
      </Button>
      <Button onClick={() => publishMedia(false, { audio: true })}>
        publish audio
      </Button>
      <Button onClick={() => publishDisplay(true)}>
        publish simulcast display
      </Button>
    </Stack>
  );
};
