import { FC, useContext } from "react";
import { Box, Button, Flex, Stack, Badge } from "@chakra-ui/react";
import { ClientContext } from "..";

export const Control: FC = () => {
  const client = useContext(ClientContext);

  const publish = async (
    simulcast: boolean,
    constraints: MediaStreamConstraints
  ) => {
    const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    await client.publish({ track: mediaStream.getTracks()[0], simulcast });
  };

  return (
    <Stack direction="row">
      <Button onClick={() => publish(true, { video: true })}>
        publish simulcast
      </Button>
      <Button onClick={() => publish(false, { video: true })}>publish</Button>
      <Button onClick={() => publish(false, { audio: true })}>
        publish audio
      </Button>
    </Stack>
  );
};
