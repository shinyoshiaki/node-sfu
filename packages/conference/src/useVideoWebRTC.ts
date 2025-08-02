import { useCallback, useEffect, useRef, useState } from "react";
import {
  Client,
  type DataPublication,
  type DataSubscription,
  type RemoteMember,
} from "../../client/src/index.js";
import { useScreenShare } from "./hooks/useScreenShare.js";
import { type ChatMessage, chatActions } from "./stores/chatStore.js";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4001";

type ConnectionStatus = "disconnected" | "connecting" | "connected";

interface MemberStream {
  memberId: string;
  stream: MediaStream;
  hasVideo: boolean;
  hasAudio: boolean;
  screenStream?: MediaStream;
  isScreenSharing?: boolean;
}

interface UseVideoWebRTCReturn {
  client: Client | null;
  localStream: MediaStream | null;
  remoteStreams: MediaStream[];
  memberStreams: MemberStream[];
  remoteMembers: RemoteMember[];
  connectionStatus: ConnectionStatus;
  isCameraOn: boolean;
  isMicrophoneOn: boolean;
  screenShare: {
    isSharing: boolean;
    isSupported: boolean;
    error: string | null;
    screenStream: MediaStream | null;
    startSharing: () => Promise<void>;
    stopSharing: () => Promise<void>;
  };
  chat: {
    sendMessage: (content: string) => Promise<void>;
  };
  createRoom: () => Promise<string>;
  joinRoom: (roomId: string, participantName?: string) => Promise<void>;
  leaveRoom: () => void;
  toggleCamera: () => void;
  toggleMicrophone: () => Promise<void>;
}

export function useVideoWebRTC(): UseVideoWebRTCReturn {
  const [client, setClient] = useState<Client | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<MediaStream[]>([]);
  const [memberStreams, setMemberStreams] = useState<MemberStream[]>([]);
  const [remoteMembers, setRemoteMembers] = useState<RemoteMember[]>([]);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicrophoneOn, setIsMicrophoneOn] = useState(false);
  const memberIdRef = useRef<string | null>(null);
  const memberToStreamsRef = useRef<Map<string, Set<string>>>(new Map());
  const audioPublicationRef = useRef<any | null>(null);
  const [chatPublication, setChatPublication] =
    useState<DataPublication | null>(null);
  const [chatSubscriptions, setChatSubscriptions] = useState<
    Map<string, DataSubscription>
  >(new Map());
  const memberNameRef = useRef<string | null>(null);

  // Get debug mode from URL
  const debugMode =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debug") === "true";

  // Initialize screen sharing hook
  const screenShareHook = useScreenShare(client, debugMode);

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

  const joinRoom = async (roomId: string, participantName?: string) => {
    console.log("Joining room:", roomId);
    try {
      setConnectionStatus("connecting");

      // Get local video stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false, // Stage 1: video only
      });
      setLocalStream(stream);

      // Initialize microphone state based on actual audio tracks
      const audioTracks = stream.getAudioTracks();
      setIsMicrophoneOn(audioTracks.length > 0 && audioTracks[0].enabled);

      console.log("Local stream obtained:", stream);

      // Join room
      const joinRequest = participantName ? { name: participantName } : {};

      const joinResponse = await fetch(`${SERVER_URL}/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(joinRequest),
      });

      if (!joinResponse.ok) {
        console.error("Join response error:", await joinResponse.text());
        throw new Error(`Failed to join room: ${joinResponse.statusText}`);
      }

      const { memberId, offer } = await joinResponse.json();
      memberIdRef.current = memberId;
      memberNameRef.current = participantName || null;

      // Create WebRTC client and set up connection
      const newClient = await Client.create(offer, memberId);

      newClient.onControlMessage.subscribe((message) => {
        console.log(
          { memberId: newClient.id },
          "Received control message:",
          message,
        );
      });

      // Set up data publication event handler for existing publications
      newClient.onPublicationReady.subscribe(async (remotePublication) => {
        console.log(
          `Data publication ready: ${remotePublication.id} from ${remotePublication.publisher} (${remotePublication.metadata?.type || "unknown"})`,
        );

        // Handle chat publications
        if (
          remotePublication.metadata?.type === "chat" &&
          remotePublication.publisher !== memberId
        ) {
          try {
            const subscription = await newClient.subscribeData(
              remotePublication.id,
            );
            subscription.onMessage.subscribe((data) => {
              try {
                const message: ChatMessage = JSON.parse(data as string);
                chatActions.addMessage(message);
                console.log("Received chat message:", message);
              } catch (error) {
                console.error("Failed to parse chat message:", error);
              }
            });

            setChatSubscriptions((prev) => {
              const newMap = new Map(prev);
              newMap.set(remotePublication.id, subscription);
              return newMap;
            });

            console.log(
              `Subscribed to chat from ${remotePublication.publisher}`,
            );
          } catch (error) {
            console.error("Failed to subscribe to chat:", error);
          }
        }
      });

      // Set up media unpublished event handler
      newClient.onMediaUnpublished.subscribe((publicationId) => {
        console.log(`Media unpublished: ${publicationId}`);

        // Update member streams to handle screen share unpublishing
        setMemberStreams((prev) => {
          return prev.map((memberStream) => {
            // Check if this member has a screen share to remove
            if (memberStream.screenStream) {
              // For now, assume screen share was unpublished - we could make this more precise
              // by tracking publication IDs per member
              const updatedMember = {
                ...memberStream,
                screenStream: undefined,
                isScreenSharing: false,
              };

              console.log(
                `Removed screen share for member ${memberStream.memberId}`,
              );

              return updatedMember;
            }

            // Handle audio unpublishing for camera streams
            const updatedMember = {
              ...memberStream,
              hasAudio: false, // Assume unpublished media was audio
            };

            console.log(
              `Updated member ${memberStream.memberId} - hasAudio set to false due to unpublish`,
            );

            return updatedMember;
          });
        });
      });

      // Set up media publication event handler before connection
      newClient.onMediaPublicationReady.subscribe(async (remotePublication) => {
        console.log(
          `Media publication ready: ${remotePublication.id} from member ${remotePublication.publisher} (${remotePublication.type})`,
          "metadata:",
          remotePublication.metadata,
        );
        try {
          // Don't subscribe to our own publications
          if (remotePublication.publisher === memberIdRef.current) {
            return;
          }

          console.log(
            `Subscribing to ${remotePublication.type} publication: ${remotePublication.id}`,
          );
          const subscription = await newClient.subscribeMedia(
            remotePublication.id,
          );
          if (subscription.track) {
            const track = subscription.track as MediaStreamTrack;
            const memberId = remotePublication.publisher;
            const metadata = remotePublication.metadata || {};
            const isScreenShare = metadata.source === "screen";

            setMemberStreams((prev) => {
              console.log(
                `Processing ${isScreenShare ? "screen share" : "camera"} track for member ${memberId}`,
              );
              console.log("Current member streams count:", prev.length);
              console.log("Track metadata:", metadata);

              const existingMemberIndex = prev.findIndex(
                (ms) => ms.memberId === memberId,
              );

              if (existingMemberIndex >= 0) {
                // Update existing member stream
                const existingMember = prev[existingMemberIndex];
                let updatedMember = { ...existingMember };

                if (isScreenShare) {
                  // Handle screen share separately
                  const screenStream = new MediaStream([track]);
                  updatedMember = {
                    ...updatedMember,
                    screenStream,
                    isScreenSharing: true,
                  };
                  console.log(
                    `Updated screen share for member ${memberId}`,
                    updatedMember,
                  );
                } else {
                  // Handle camera/audio
                  const updatedStream = existingMember.stream.clone();
                  updatedStream.addTrack(track);
                  updatedMember = {
                    ...updatedMember,
                    stream: updatedStream,
                    hasVideo: existingMember.hasVideo || track.kind === "video",
                    hasAudio: existingMember.hasAudio || track.kind === "audio",
                  };
                  console.log(
                    `Updated ${track.kind} for member ${memberId}`,
                    updatedMember,
                  );
                }

                const newMemberStreams = [...prev];
                newMemberStreams[existingMemberIndex] = updatedMember;

                // Also update remoteStreams for backward compatibility
                setRemoteStreams(newMemberStreams.map((ms) => ms.stream));

                console.log("Updated member streams:", newMemberStreams);
                return newMemberStreams;
              } else {
                // Create new member stream
                let newMemberStream: MemberStream;

                console.log(
                  `Created new ${newClient.id} ${track.kind} stream for member ${memberId}`,
                );
                if (isScreenShare) {
                  // Create member with screen share
                  const screenStream = new MediaStream([track]);
                  newMemberStream = {
                    memberId,
                    stream: new MediaStream(), // Empty camera stream
                    hasVideo: false,
                    hasAudio: false,
                    screenStream,
                    isScreenSharing: true,
                  };
                  console.log(
                    `Created new screen share for member ${memberId}`,
                    newMemberStream,
                  );
                } else {
                  // Create member with camera/audio
                  const newStream = new MediaStream([track]);
                  newMemberStream = {
                    memberId,
                    stream: newStream,
                    hasVideo: track.kind === "video",
                    hasAudio: track.kind === "audio",
                    isScreenSharing: false,
                  };
                  console.log(
                    `Created new ${track.kind} stream for member ${memberId}`,
                    newMemberStream,
                  );
                }

                const newMemberStreams = [...prev, newMemberStream];

                // Also update remoteStreams for backward compatibility
                setRemoteStreams(newMemberStreams.map((ms) => ms.stream));

                console.log(
                  "New member streams after creation:",
                  newMemberStreams,
                );
                return newMemberStreams;
              }
            });

            // Track which member owns this stream for cleanup
            if (!memberToStreamsRef.current.has(remotePublication.publisher)) {
              memberToStreamsRef.current.set(
                remotePublication.publisher,
                new Set(),
              );
            }
            memberToStreamsRef.current
              .get(remotePublication.publisher)!
              .add(remotePublication.id);
          } else {
            console.warn(
              `No track available for subscription ${subscription.subscriptionId}`,
            );
          }
        } catch (error) {
          console.error(
            `Failed to subscribe to publication ${remotePublication.id}:`,
            error,
          );
        }
      });

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

      // Set up member joined handler
      newClient.onMemberJoined.subscribe((memberInfo) => {
        console.log(
          `Member ${memberInfo.name || memberInfo.memberId} joined the room`,
        );
        setRemoteMembers((prev) => {
          const existing = prev.find((m) => m.id === memberInfo.memberId);
          if (!existing) {
            return [
              ...prev,
              {
                id: memberInfo.memberId,
                name: memberInfo.name,
                metadata: memberInfo.metadata,
              },
            ];
          }
          return prev;
        });
      });

      // Set up member left handler
      newClient.onMemberLeft.subscribe((leftMemberId) => {
        console.log(`Member ${leftMemberId} left the room`);

        // Remove member from remote members list
        setRemoteMembers((prev) =>
          prev.filter((member) => member.id !== leftMemberId),
        );

        // Remove member streams
        setMemberStreams((prev) => {
          const filtered = prev.filter((ms) => ms.memberId !== leftMemberId);

          // Also update remoteStreams for backward compatibility
          setRemoteStreams(filtered.map((ms) => ms.stream));

          return filtered;
        });

        // Clean up the member mapping
        const streamIds = memberToStreamsRef.current.get(leftMemberId);
        if (streamIds) {
          memberToStreamsRef.current.delete(leftMemberId);
          console.log(
            `Removed ${streamIds.size} publications from member ${leftMemberId}`,
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

      // Get existing members after connection is established
      newClient.onConnected.subscribe(async () => {
        const existingMembers = newClient.getRemoteMembers();
        setRemoteMembers(existingMembers);
        console.log("Existing members:", existingMembers);

        // Set up chat publication
        try {
          const chatPub = await newClient.publishData({
            type: "chat",
            memberId: memberId,
            memberName: participantName || undefined,
          });
          setChatPublication(chatPub);
          console.log("Chat publication created:", chatPub.publicationId);
        } catch (error) {
          console.error("Failed to create chat publication:", error);
        }
      });
    } catch (error) {
      console.error("Failed to join room:", error);
      setConnectionStatus("disconnected");
      throw error;
    }
  };

  const toggleCamera = useCallback(() => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks[0].enabled = !videoTracks[0].enabled;
        setIsCameraOn(videoTracks[0].enabled);
      }
    }
  }, [localStream]);

  const toggleMicrophone = useCallback(async () => {
    if (!localStream || !client) return;

    try {
      if (isMicrophoneOn) {
        // Turn off microphone - unpublish audio if published
        if (audioPublicationRef.current) {
          await client.unpublishMedia(
            audioPublicationRef.current.publicationId,
          );
          audioPublicationRef.current = null;
        }

        // Remove audio tracks from local stream
        const audioTracks = localStream.getAudioTracks();
        audioTracks.forEach((track) => {
          localStream.removeTrack(track);
          track.stop();
        });

        setIsMicrophoneOn(false);
      } else {
        // Turn on microphone - get new audio track and publish
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const audioTrack = audioStream.getAudioTracks()[0];

        if (audioTrack) {
          localStream.addTrack(audioTrack);

          // Publish the new audio track
          const publication = await client.publishMedia(audioTrack);
          audioPublicationRef.current = publication;
          console.log("Published audio track:", publication.publicationId);
        }

        setIsMicrophoneOn(true);
      }
    } catch (error) {
      console.error("Failed to toggle microphone:", error);
    }
  }, [localStream, client, isMicrophoneOn]);

  const sendChatMessage = useCallback(
    async (content: string) => {
      if (chatPublication && memberIdRef.current) {
        try {
          const message = chatActions.createMessage(
            content,
            memberIdRef.current,
            memberNameRef.current || undefined,
          );
          chatPublication.send(JSON.stringify(message));
          chatActions.addMessage(message); // Add to local state immediately
          console.log("Sent chat message:", message);
        } catch (error) {
          console.error("Failed to send chat message:", error);
          throw error;
        }
      } else {
        console.warn("Chat not ready: publication or memberId missing");
        throw new Error("Chat not ready");
      }
    },
    [chatPublication],
  );

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

    // Reset member ID
    if (memberIdRef.current) {
      memberIdRef.current = null;
    }

    // Reset audio publication ref
    audioPublicationRef.current = null;

    // Reset chat state
    setChatPublication(null);
    setChatSubscriptions(new Map());
    memberNameRef.current = null;

    setRemoteStreams([]);
    setMemberStreams([]);
    setRemoteMembers([]);
    memberToStreamsRef.current.clear();
    setConnectionStatus("disconnected");
    setIsCameraOn(true);
    setIsMicrophoneOn(false);
  }, [client, localStream]);

  return {
    client,
    localStream,
    remoteStreams,
    memberStreams,
    remoteMembers,
    connectionStatus,
    isCameraOn,
    isMicrophoneOn,
    screenShare: {
      isSharing: screenShareHook.isSharing,
      isSupported: screenShareHook.isSupported,
      error: screenShareHook.error,
      screenStream: screenShareHook.screenStream,
      startSharing: screenShareHook.startScreenShare,
      stopSharing: screenShareHook.stopScreenShare,
    },
    chat: {
      sendMessage: sendChatMessage,
    },
    createRoom,
    joinRoom,
    leaveRoom,
    toggleCamera,
    toggleMicrophone,
  };
}
