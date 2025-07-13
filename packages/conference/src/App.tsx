import { useState } from "react";
import { ConferencePage } from "./components/ConferencePage";
import { HomePage } from "./components/HomePage";
import { useVideoWebRTC } from "./useVideoWebRTC";

function App() {
  const [currentRoomId, setCurrentRoomId] = useState("");
  const {
    localStream,
    remoteStreams,
    connectionStatus,
    createRoom,
    joinRoom,
    leaveRoom,
  } = useVideoWebRTC();

  const handleCreateRoom = async () => {
    const newRoomId = await createRoom();
    return newRoomId;
  };

  const handleJoinRoom = async (roomId: string) => {
    await joinRoom(roomId);
    setCurrentRoomId(roomId);
  };

  const handleLeaveRoom = () => {
    leaveRoom();
    setCurrentRoomId("");
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
      connectionStatus={connectionStatus}
      onLeaveRoom={handleLeaveRoom}
    />
  );
}

export default App;
