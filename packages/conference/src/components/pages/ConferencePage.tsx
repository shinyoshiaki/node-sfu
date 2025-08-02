import { useSnapshot } from "valtio";
import type { RemoteMember } from "../../../../client/src/index.js";
import { chatActions, chatState } from "../../stores/chatStore.js";
import { ChatPanel } from "../chat/ChatPanel.js";
import { ControlBar } from "../conference/ControlBar.js";
import { Header } from "../conference/Header.js";
import { ConferenceLayout } from "../conference/layout/ConferenceLayout.js";

interface MemberStream {
  memberId: string;
  stream: MediaStream;
  hasVideo: boolean;
  hasAudio: boolean;
  screenStream?: MediaStream;
  isScreenSharing?: boolean;
}

interface ConferencePageProps {
  roomId: string;
  localStream: MediaStream | null;
  remoteStreams: MediaStream[];
  memberStreams: MemberStream[];
  remoteMembers: RemoteMember[];
  connectionStatus: string;
  participantName?: string;
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
  currentMemberId: string | null;
  onLeaveRoom: () => void;
  onToggleCamera: () => void;
  onToggleMicrophone: () => void;
}

export function ConferencePage({
  roomId,
  localStream,
  remoteStreams,
  memberStreams,
  remoteMembers,
  connectionStatus,
  participantName,
  isCameraOn,
  isMicrophoneOn,
  screenShare,
  chat,
  currentMemberId,
  onLeaveRoom,
  onToggleCamera,
  onToggleMicrophone,
}: ConferencePageProps) {
  const chatSnapshot = useSnapshot(chatState);

  // Combine local screen share info with member streams
  const enhancedMemberStreams = [...memberStreams];
  if (screenShare.isSharing && screenShare.screenStream && currentMemberId) {
    // Check if local screen share is already in memberStreams
    const localShareIndex = enhancedMemberStreams.findIndex(
      (m) => m.memberId === currentMemberId && m.isScreenSharing,
    );

    if (localShareIndex === -1) {
      // Add local screen share if not already present
      enhancedMemberStreams.push({
        memberId: currentMemberId,
        stream: localStream!,
        hasVideo: isCameraOn,
        hasAudio: isMicrophoneOn,
        screenStream: screenShare.screenStream,
        isScreenSharing: true,
      });
    }
  }

  return (
    <div className="h-screen bg-[#202124] flex flex-col overflow-hidden">
      <Header
        roomId={roomId}
        connectionStatus={connectionStatus}
        onLeaveRoom={onLeaveRoom}
      />

      <main className="flex-1 min-h-0">
        <ConferenceLayout
          localStream={localStream}
          memberStreams={enhancedMemberStreams}
          remoteMembers={remoteMembers}
          currentMemberId={currentMemberId}
          participantName={participantName}
        />
      </main>

      <ControlBar
        isCameraOn={isCameraOn}
        isMicrophoneOn={isMicrophoneOn}
        screenShare={screenShare}
        unreadCount={chatSnapshot.unreadCount}
        onToggleCamera={onToggleCamera}
        onToggleMicrophone={onToggleMicrophone}
        onToggleChat={chatActions.toggleVisibility}
        onLeaveRoom={onLeaveRoom}
      />

      <ChatPanel
        isVisible={chatSnapshot.isVisible}
        messages={[...chatSnapshot.messages]}
        unreadCount={chatSnapshot.unreadCount}
        currentMemberId={currentMemberId || ""}
        onSendMessage={chat.sendMessage}
        onClose={chatActions.toggleVisibility}
      />
    </div>
  );
}
