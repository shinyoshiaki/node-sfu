import { Badge, Box, Button, Center, Flex, Stack } from "@chakra-ui/react";
import { FC, useContext, useEffect, useRef, useState } from "react";
import { ClientContext } from "../..";
import { MediaInfo, SubscriberType } from "../../../../../packages/core/src";
import { Media } from "./media";

export const Medias: FC = () => {
  const [medias, setMedias] = useState<MediaInfo[]>([]);

  const client = useContext(ClientContext);

  useEffect(() => {
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
      <Badge>medias</Badge>
      <Flex flexWrap="wrap">
        {medias.map((info) => (
          <Media info={info} key={info.mediaId} />
        ))}
      </Flex>
    </Box>
  );
};
