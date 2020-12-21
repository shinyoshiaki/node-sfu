import { Badge, Box, Button, Flex, Text } from "@chakra-ui/react";
import { FC, useContext, useEffect, useState } from "react";
import { ClientContext } from "../..";
import { MediaInfo } from "../../../../../packages/core/src";

export const Published: FC = () => {
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
          <Box key={info.mediaId} borderWidth="1px" padding={1}>
            {Object.entries(info).map(([k, v]) => (
              <Text key={k}>
                {k} : {v.toString()}
              </Text>
            ))}
            <Button onClick={() => client.unPublish(info)}>un publish</Button>
          </Box>
        ))}
      </Flex>
    </Box>
  );
};
