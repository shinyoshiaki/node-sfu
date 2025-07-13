import { useCallback, useRef, useState } from "react";
import { Client } from "../../client/src/index.js";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4001";

type ConnectionStatus = "disconnected" | "connecting" | "connected";

interface UseVideoWebRTCReturn {
  client: Client | null;
  localStream: MediaStream | null;
  remoteStreams: MediaStream[];
  connectionStatus: ConnectionStatus;
  createRoom: () => Promise<string>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => void;
}

export function useVideoWebRTC(): UseVideoWebRTCReturn {
  const [client, setClient] = useState<Client | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<MediaStream[]>([]);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const memberIdRef = useRef<string | null>(null);
  const memberToStreamsRef = useRef<Map<string, Set<string>>>(new Map());

  const createRoom = async () => {
    const createResponse = await fetch(`${SERVER_URL}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create room: ${createResponse.statusText}`);
    }

    const { roomId } = await createResponse.json();
    return roomId;
  };

  const joinRoom = async (roomId: string) => {
    console.log("Joining room:", roomId);
    try {
      setConnectionStatus("connecting");

      // Get local video stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false, // Stage 1: video only
      });
      setLocalStream(stream);

      console.log("Local stream obtained:", stream);

      // Join room
      const joinResponse = await fetch(`${SERVER_URL}/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!joinResponse.ok) {
        throw new Error(`Failed to join room: ${joinResponse.statusText}`);
      }

      const { memberId, offer } = await joinResponse.json();
      memberIdRef.current = memberId;

      // Create WebRTC client and set up connection
      const newClient = await Client.create(offer, memberId);

      newClient.onControlMessage.subscribe((message) => {
        console.log("Received control message:", message);
      });

      // Set up data publication event handler for existing publications
      newClient.onPublicationReady.subscribe(async (publicationId) => {
        console.log(
          `Data publication ready: ${publicationId} (existing publication discovered)`,
        );
        // Future enhancement: could subscribe to data channels here
      });

      // Set up media publication event handler before connection
      newClient.onMediaPublicationReady.subscribe(
        async (publicationId, publisherMemberId) => {
          console.log(
            `Media publication ready: ${publicationId} from member ${publisherMemberId}`,
          );
          try {
            // Don't subscribe to our own publications
            if (publisherMemberId === memberIdRef.current) {
              return;
            }

            console.log(
              `Subscribing to existing media publication: ${publicationId}`,
            );
            const subscription = await newClient.subscribeMedia(publicationId);
            if (subscription.track) {
              const remoteStream = new MediaStream([
                subscription.track as MediaStreamTrack,
              ]);

              // Track which member owns this stream
              if (!memberToStreamsRef.current.has(publisherMemberId)) {
                memberToStreamsRef.current.set(publisherMemberId, new Set());
              }
              memberToStreamsRef.current
                .get(publisherMemberId)!
                .add(remoteStream.id);

              setRemoteStreams((prev) => {
                console.log(
                  `Added remote stream from publication ${publicationId}`,
                );
                return [...prev, remoteStream];
              });
            } else {
              console.warn(
                `No track available for subscription ${subscription.subscriptionId}`,
              );
            }
          } catch (error) {
            console.error(
              `Failed to subscribe to publication ${publicationId}:`,
              error,
            );
          }
        },
      );

      // Set up ICE candidate handling
      newClient.onIceCandidate.subscribe(async (candidate) => {
        try {
          await fetch(`${SERVER_URL}/members/${memberId}/ice-candidate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ candidate }),
          });
        } catch (error) {
          console.warn("Failed to send ICE candidate:", error);
        }
      });

      // Set up member left handler
      newClient.onMemberLeft.subscribe((leftMemberId) => {
        console.log(`Member ${leftMemberId} left the room`);

        // Get all stream IDs for this member
        const streamIds = memberToStreamsRef.current.get(leftMemberId);
        if (streamIds) {
          // Remove streams from state
          setRemoteStreams((prev) => {
            return prev.filter((stream) => !streamIds.has(stream.id));
          });

          // Clean up the member mapping
          memberToStreamsRef.current.delete(leftMemberId);
          console.log(
            `Removed ${streamIds.size} streams from member ${leftMemberId}`,
          );
        }
      });

      // Create answer
      const answer = await newClient.createAndSetAnswer();

      // Send answer back to server
      const answerResponse = await fetch(
        `${SERVER_URL}/members/${memberId}/answer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answer }),
        },
      );

      if (!answerResponse.ok) {
        throw new Error(`Failed to send answer: ${answerResponse.statusText}`);
      }

      // Publish local video
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        console.log("start publish");
        const publication = await newClient.publishMedia(videoTrack);
        console.log("published media:", publication);
      }

      setClient(newClient);
      setConnectionStatus("connected");
    } catch (error) {
      console.error("Failed to join room:", error);
      setConnectionStatus("disconnected");
      throw error;
    }
  };

  const leaveRoom = useCallback(() => {
    // Stop local stream
    if (localStream) {
      for (const track of localStream.getTracks()) {
        track.stop();
      }
      setLocalStream(null);
    }

    // Close WebRTC client
    if (client) {
      client.close();
      setClient(null);
    }

    // Leave room via API
    if (memberIdRef.current) {
      fetch(`${SERVER_URL}/members/${memberIdRef.current}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch((error) => {
        console.error("Failed to leave room:", error);
      });
      memberIdRef.current = null;
    }

    setRemoteStreams([]);
    memberToStreamsRef.current.clear();
    setConnectionStatus("disconnected");
  }, [client, localStream]);

  return {
    client,
    localStream,
    remoteStreams,
    connectionStatus,
    createRoom,
    joinRoom,
    leaveRoom,
  };
}
