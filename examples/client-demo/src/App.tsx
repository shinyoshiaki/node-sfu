import { FC, useContext, useEffect, useRef, useState } from "react";
import { Context } from ".";
import { MediaInfo, SubscriberType } from "../../../packages/client/src";
import { Box, Button, Flex, Stack, Badge } from "@chakra-ui/react";

const App: FC = () => {
  const client = useContext(Context);
  const videos = useRef<HTMLVideoElement[]>([]);
  const [streams, setStreams] = useState<
    { stream: MediaStream; info: MediaInfo }[]
  >([]);
  const [published, setPublished] = useState<MediaInfo[]>([]);
  const [medias, setMedias] = useState<MediaInfo[]>([]);

  const init = async () => {
    const params = new URLSearchParams(window.location.hash.split("#")[1]);

    if (!params.has("room")) {
      await client.apiCreate();
      window.location.hash = `?room=${client.roomName}`;
    } else client.roomName = params.get("room")!;

    console.log("roomName", client.roomName);

    client.apiJoin();
    await client.events.onConnect.asPromise();

    listen();

    await client.getMedias();
    await publish(true, { video: true });
  };

  const listen = () => {
    client.events.onTrack.subscribe((stream, info) => {
      stream.onremovetrack = () => {
        setStreams((streams) =>
          streams.filter(({ stream: s }) => stream.id !== s.id)
        );
      };
      setStreams((streams) => [...streams, { stream, info }]);
    });
    client.events.onJoin.subscribe((peerId) => {
      console.log("join", peerId);
    });
    client.events.onPublish.subscribe(() => {
      setPublished(client.user.published);
      setMedias(Object.values(client.medias));
    });
    client.events.onUnPublish.subscribe(() => {
      setPublished(client.user.published);
      setMedias(Object.values(client.medias));
    });
  };

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    videos.current.forEach((v, i) => {
      if (streams[i]) v.srcObject = streams[i].stream;
    });
  }, [streams]);

  const changeQuality = (info: MediaInfo, type: SubscriberType) => {
    client.changeQuality(info, type);
  };

  const publish = async (
    simulcast: boolean,
    constraints: MediaStreamConstraints
  ) => {
    const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    await client.publish({ track: mediaStream.getTracks()[0], simulcast });
  };

  return (
    <Box>
      <Stack direction="row">
        <Button onClick={() => publish(true, { video: true })}>
          publish simulcast
        </Button>
        <Button onClick={() => publish(false, { video: true })}>publish</Button>
        <Button onClick={() => publish(false, { audio: true })}>
          publish audio
        </Button>
      </Stack>
      <Box p={2}>
        <Badge>published</Badge>
        <Box p={2}>
          <Flex flexWrap="wrap">
            {published.map((info, i) => (
              <Box key={i}>
                <Button onClick={() => client.unPublish(info)}>
                  un publish
                </Button>
                <div>{JSON.stringify(info)}</div>
              </Box>
            ))}
          </Flex>
        </Box>
      </Box>

      <Box p={2}>
        <Badge>medias</Badge>
        <Box p={2}>
          <Flex flexWrap="wrap">
            {medias.map((info, i) => (
              <Box key={i}>
                <Button onClick={() => client.subscribe([info])}>
                  subscribe
                </Button>
                <div>{JSON.stringify(info)}</div>
              </Box>
            ))}
          </Flex>
        </Box>
      </Box>

      <Flex style={{ display: "flex", flexWrap: "wrap", width: "100%" }}>
        {streams.map(({ info }, i) => (
          <Box key={i}>
            <p>{`${info.mediaId} ${info.publisherId}`}</p>
            {info.simulcast && (
              <Stack direction="row">
                <Button onClick={() => changeQuality(info, "low")}>low</Button>
                <Button onClick={() => changeQuality(info, "high")}>
                  high
                </Button>
                <Button onClick={() => changeQuality(info, "auto")}>
                  auto
                </Button>
              </Stack>
            )}
            <video
              ref={(ref) => {
                const arr = videos.current;
                arr[i] = ref!;
                videos.current = arr;
              }}
              autoPlay
              style={{ background: "black" }}
            />
          </Box>
        ))}
      </Flex>
    </Box>
  );
};

export default App;
