import { FC, useContext, useEffect, useRef, useState } from "react";
import { ClientContext } from ".";
import { MediaInfo, SubscriberType } from "../../../packages/client/src";
import { Box, Button, Flex, Stack, Badge } from "@chakra-ui/react";
import { Control } from "./containers/control";
import { Medias } from "./containers/remote/medias";
import { Published } from "./containers/local/published";

const App: FC = () => {
  const client = useContext(ClientContext);

  const init = async () => {
    const params = new URLSearchParams(window.location.hash.split("#")[1]);

    if (!params.has("room")) {
      await client.apiCreate();
      window.location.hash = `?room=${client.roomName}`;
    } else client.roomName = params.get("room")!;

    console.log("roomName", client.roomName);
    client.apiJoin();
  };

  useEffect(() => {
    init();
  }, []);

  return (
    <Box>
      <Control />
      <Box p={2}>
        <Published />
      </Box>
      <Box p={2}>
        <Medias />
      </Box>
    </Box>
  );
};

export default App;
