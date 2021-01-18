import { Box, Button, Center, Stack, Text } from "@chakra-ui/react";
import { FC, useContext, useEffect, useRef, useState } from "react";
import { ClientContext } from "../..";
import { MediaInfo, SubscriberType } from "../../../../../packages/client/src";

export const RemoteMedia: FC<{ info: MediaInfo }> = ({ info }) => {
  const [stream, setStream] = useState<MediaStream>();
  const [data, setData] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const client = useContext(ClientContext);

  useEffect(() => {
    client.events.onTrack.subscribe((stream, { mediaId }) => {
      if (mediaId !== info.mediaId) return;
      videoRef.current.srcObject = stream;
      setStream(stream);
    });
    client.events.onUnsubscribe.subscribe(({ mediaId }) => {
      if (mediaId !== info.mediaId) return;
      setStream(undefined);
    });
  }, []);

  const changeQuality = (info: MediaInfo, type: SubscriberType) => {
    client.changeQuality(info, type);
  };

  const subscribe = async () => {
    await client.subscribe([info]);
    client.sfu
      .getSFU(info.mediaId)
      .onMessage.subscribe((data) => setData(data));
  };

  return (
    <Box borderWidth="1px" padding={1}>
      {Object.entries(info).map(([k, v]) => (
        <Text key={k}>
          {k} : {v.toString()}
        </Text>
      ))}
      <Stack direction="row" p={1}>
        <Button onClick={subscribe} disabled={!!stream}>
          subscribe
        </Button>
        <Button onClick={() => client.unsubscribe(info)} disabled={!stream}>
          unsubscribe
        </Button>
      </Stack>
      {stream && info.simulcast && (
        <Stack direction="row" p={1}>
          <Button onClick={() => changeQuality(info, "low")}>low</Button>
          <Button onClick={() => changeQuality(info, "high")}>high</Button>
          <Button onClick={() => changeQuality(info, "auto")}>auto</Button>
        </Stack>
      )}
      <Center p={1}>
        {info.kind !== "application" ? (
          <video
            ref={videoRef}
            autoPlay
            style={{
              background: "black",
              maxWidth: 400,
              height: stream ? "auto" : 0,
            }}
          />
        ) : (
          <Box>
            <Text>{data}</Text>
          </Box>
        )}
      </Center>
    </Box>
  );
};
