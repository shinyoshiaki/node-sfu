import { useEffect, useState } from "react";
import type { RemoteMember } from "../../../../../client/src/index.js";
import { ParticipantsSidebar } from "../video/ParticipantsSidebar.js";
import { VideoPlayer } from "../video/VideoPlayer.js";

interface MemberStream {
  memberId: string;
  stream: MediaStream;
  hasVideo: boolean;
  hasAudio: boolean;
  screenStream?: MediaStream;
  isScreenSharing?: boolean;
}

interface ScreenShareModeProps {
  screenShareStream: MediaStream;
  screenShareMemberId: string;
  localStream: MediaStream | null;
  memberStreams: MemberStream[];
  remoteMembers: RemoteMember[];
  currentMemberId: string | null;
  participantName?: string;
}

export function ScreenShareMode({
  screenShareStream,
  screenShareMemberId,
  localStream,
  memberStreams,
  remoteMembers,
  currentMemberId,
  participantName,
}: ScreenShareModeProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const presenter = remoteMembers.find((m) => m.id === screenShareMemberId);
  const presenterName = presenter?.metadata?.name || "Presenter";
  const isLocalPresenting = screenShareMemberId === currentMemberId;

  return (
    <div
      className={`h-full w-full flex ${isMobile ? "flex-col" : "flex-row"} gap-2 p-4`}
    >
      {/* Screen Share Display */}
      <div
        className={`${isMobile ? "flex-1" : "flex-1"} bg-[#292a2d] rounded-lg overflow-hidden relative`}
      >
        <VideoPlayer
          stream={screenShareStream}
          muted={false}
          className="w-full h-full object-contain"
          testId="screen-share-video"
        />
        <div className="absolute top-4 left-4 bg-black/60 px-3 py-1 rounded-full">
          <span className="text-white text-sm font-medium">
            {isLocalPresenting
              ? "You are presenting"
              : `${presenterName} is presenting`}
          </span>
        </div>
      </div>

      {/* Participants Sidebar/List */}
      <ParticipantsSidebar
        localStream={localStream}
        memberStreams={memberStreams}
        remoteMembers={remoteMembers}
        currentMemberId={currentMemberId}
        participantName={participantName}
        presenterMemberId={screenShareMemberId}
        isMobile={isMobile}
      />
    </div>
  );
}
