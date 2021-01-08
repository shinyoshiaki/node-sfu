import { Badge, Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import { FC, useContext, useEffect, useRef, useState } from "react";
import { ClientContext } from "../..";
import { MCU } from "../../../../../packages/client/src/domain/mcu/mcu";
import { MediaInfo } from "../../../../../packages/core/src";
import { Mixer } from "./mixer";

export const Mixers: FC = () => {
  const client = useContext(ClientContext);

  const [mixers, setMixers] = useState<MCU[]>([]);
  const [medias, setMedias] = useState<MediaInfo[]>([]);

  useEffect(() => {
    client.events.onMixerCreated.subscribe((mcu) => {
      mcu.onAdded.subscribe(() => {});
      setMixers(client.mcu.mixers);
    });
    client.events.onConnect.once(() =>
      client.getMedias().then(() => setMedias(Object.values(client.medias)))
    );
    client.events.onPublish.subscribe(() => {
      setMedias(Object.values(client.medias));
    });
    client.events.onUnPublish.subscribe(() => {
      setMedias(Object.values(client.medias));
    });
  }, []);

  return (
    <Box>
      <Badge>mixers</Badge>
      {mixers.map((mixer) => (
        <Mixer mixer={mixer} medias={medias} key={mixer.id} />
      ))}
    </Box>
  );
};
