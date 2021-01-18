import { FC, useContext, useEffect, useState } from "react";
import { ClientContext } from ".";
import { Box, Stack, Text } from "@chakra-ui/react";
import { Control } from "./containers/control";
import { RemoteMedias } from "./containers/remote/medias";
import { LocalMedias } from "./containers/local/medias";
import { Mixers } from "./containers/mcu/mixers";

const App: FC = () => {
  const client = useContext(ClientContext);
  const [peerId, setPeerId] = useState("");

  const init = async () => {
    const params = new URLSearchParams(window.location.hash.split("#")[1]);

    if (!params.has("room")) {
      await client.apiCreate();
      window.location.hash = `?room=${client.roomName}`;
    } else client.roomName = params.get("room")!;

    console.log("roomName", client.roomName);
    client.apiJoin();
    client.events.onConnect.subscribe(() => setPeerId(client.peerId));
  };

  useEffect(() => {
    init();
  }, []);

  return (
    <Box>
      <Text>peerId : {peerId}</Text>
      <Stack p={2}>
        <Control />
        <LocalMedias />
        <RemoteMedias />
        <Mixers />
      </Stack>
    </Box>
  );
};

export default App;
