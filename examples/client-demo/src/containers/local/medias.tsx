import { Badge, Box, Button, Flex, Text } from "@chakra-ui/react";
import { FC, useContext, useEffect, useState } from "react";
import { ClientContext } from "../..";
import { MediaInfo } from "../../../../../packages/core/src";
import { PublishedMedia } from "./media";

export const PublishedMedias: FC = () => {
  const client = useContext(ClientContext);
  const [published, setPublished] = useState<MediaInfo[]>([]);

  useEffect(() => {
    client.events.onPublish.subscribe(() => {
      setPublished(client.user.published);
    });
    client.events.onUnPublish.subscribe(() => {
      setPublished(client.user.published);
    });
  }, []);

  return (
    <Box>
      <Badge>published</Badge>
      <Flex flexWrap="wrap">
        {published.map((info) => (
          <PublishedMedia info={info} key={info.mediaId} />
        ))}
      </Flex>
    </Box>
  );
};
