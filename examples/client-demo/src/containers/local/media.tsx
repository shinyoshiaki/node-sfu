import { Box, Button, Text, Textarea } from "@chakra-ui/react";
import { ChangeEvent, FC, useContext, useState } from "react";
import { ClientContext } from "../..";
import { MediaInfo } from "../../../../../packages/core/src";

export const LocalMedia: FC<{ info: MediaInfo }> = ({ info }) => {
  const client = useContext(ClientContext);

  const isData = info.kind === "application";
  const [data, setData] = useState("");
  const onData = ({ target: { value } }: ChangeEvent<HTMLTextAreaElement>) => {
    setData(value);
    client.connection.datachannels["messaging"].send(value);
    // todo impl
  };

  return (
    <Box borderWidth="1px" padding={1}>
      {Object.entries(info).map(([k, v]) => (
        <Text key={k}>
          {k} : {v.toString()}
        </Text>
      ))}
      {isData && (
        <Box>
          <Textarea value={data} onChange={onData} />
        </Box>
      )}
      <Button onClick={() => client.unPublish(info)}>un publish</Button>
    </Box>
  );
};
