import { Badge, Box, Flex } from "@chakra-ui/react";
import { FC, useContext, useEffect, useState } from "react";
import { ClientContext } from "../..";
import { MediaInfo } from "../../../../../packages/core/src";
import { RemoteMedia } from "./media";

export const RemoteMedias: FC = () => {
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
          <RemoteMedia info={info} key={info.mediaId} />
        ))}
      </Flex>
    </Box>
  );
};
