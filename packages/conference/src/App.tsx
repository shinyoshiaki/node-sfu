import { useState } from "react";
import { ConferencePage } from "./components/pages/ConferencePage";
import { HomePage } from "./components/pages/HomePage";
import { useVideoWebRTC } from "./useVideoWebRTC";

function App() {
  const [currentRoomId, setCurrentRoomId] = useState("");
  const [participantName, setParticipantName] = useState("");
  const {
    client,
    localStream,
    remoteStreams,
    memberStreams,
    remoteMembers,
    connectionStatus,
    isCameraOn,
    isMicrophoneOn,
    screenShare,
    chat,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleCamera,
    toggleMicrophone,
  } = useVideoWebRTC();

  const handleCreateRoom = async (name?: string) => {
    const newRoomId = await createRoom();
    if (name) {
      setParticipantName(name);
    }
    return newRoomId;
  };

  const handleJoinRoom = async (roomId: string, name?: string) => {
    await joinRoom(roomId, name);
    setCurrentRoomId(roomId);
    if (name) {
      setParticipantName(name);
    }
  };

  const handleLeaveRoom = () => {
    leaveRoom();
    setCurrentRoomId("");
    setParticipantName("");
  };

  if (connectionStatus === "disconnected" || !currentRoomId) {
    return (
      <HomePage onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
    );
  }

  return (
    <ConferencePage
      roomId={currentRoomId}
      localStream={localStream}
      remoteStreams={remoteStreams}
      memberStreams={memberStreams}
      remoteMembers={remoteMembers}
      connectionStatus={connectionStatus}
      participantName={participantName}
      isCameraOn={isCameraOn}
      isMicrophoneOn={isMicrophoneOn}
      screenShare={screenShare}
      chat={chat}
      currentMemberId={client?.id || null}
      onLeaveRoom={handleLeaveRoom}
      onToggleCamera={toggleCamera}
      onToggleMicrophone={toggleMicrophone}
    />
  );
}

export default App;
