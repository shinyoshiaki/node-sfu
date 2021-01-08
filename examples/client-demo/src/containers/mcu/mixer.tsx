import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import { FC, useContext, useEffect, useRef, useState } from "react";
import { ClientContext } from "../..";
import { MCU } from "../../../../../packages/client/src/domain/mcu/mcu";
import { MediaInfo } from "../../../../../packages/core/src";

export const Mixer: FC<{ medias: MediaInfo[]; mixer: MCU }> = ({
  mixer,
  medias,
}) => {
  const client = useContext(ClientContext);
  const audioRef = useRef<HTMLAudioElement>();
  const [listen, setListen] = useState<MediaInfo[]>([]);

  useEffect(() => {
    const { stream } = Object.values(client.streams).find(
      (v) => v.info.publisherId === mixer.id
    );
    audioRef.current.srcObject = stream;
    client.events.onTrack.subscribe((stream, info) => {
      if (info.publisherId === mixer.id) {
        audioRef.current.srcObject = stream;
      }
    });
    mixer.onAdded.subscribe(() => setListen(Object.values(mixer.infos)));
    mixer.onRemoved.subscribe(() => setListen(Object.values(mixer.infos)));
  }, []);

  return (
    <Box key={mixer.id} p={1}>
      <audio ref={audioRef} autoPlay />
      <Text fontWeight="bold">mixerId {mixer.id}</Text>
      <Stack direction="row">
        <Text>mixing list</Text>
        {listen.map((v) => (
          <Text key={v.mediaId}>{v.mediaId}</Text>
        ))}
      </Stack>
      <Flex flexWrap="wrap">
        {medias
          .filter((v) => v.kind === "audio")
          .map((info) => (
            <Box key={info.mediaId} borderWidth="1px" padding={1}>
              {Object.entries(info).map(([k, v]) => (
                <Text key={k}>
                  {k} : {v.toString()}
                </Text>
              ))}
              <Stack direction="row">
                <Button
                  onClick={() => client.addMixedAudioTrack(mixer.id, info)}
                >
                  add
                </Button>
                <Button
                  onClick={() => client.removeMixedAudioTrack(mixer.id, info)}
                >
                  remove
                </Button>
              </Stack>
            </Box>
          ))}
      </Flex>
    </Box>
  );
};
