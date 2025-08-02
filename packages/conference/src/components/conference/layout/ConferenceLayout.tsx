import { useEffect, useState } from "react";
import type { RemoteMember } from "../../../../../client/src/index.js";
import { ConferenceMode } from "../modes/ConferenceMode.js";
import { ScreenShareMode } from "../modes/ScreenShareMode.js";

interface MemberStream {
  memberId: string;
  stream: MediaStream;
  hasVideo: boolean;
  hasAudio: boolean;
  screenStream?: MediaStream;
  isScreenSharing?: boolean;
}

interface ConferenceLayoutProps {
  localStream: MediaStream | null;
  memberStreams: MemberStream[];
  remoteMembers: RemoteMember[];
  currentMemberId: string | null;
  participantName?: string;
}

export function ConferenceLayout({
  localStream,
  memberStreams,
  remoteMembers,
  currentMemberId,
  participantName,
}: ConferenceLayoutProps) {
  const [isScreenShareMode, setIsScreenShareMode] = useState(false);
  const [screenShareStream, setScreenShareStream] =
    useState<MediaStream | null>(null);
  const [screenShareMemberId, setScreenShareMemberId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    // Detect if any participant is screen sharing
    const screenSharer = memberStreams.find(
      (member) => member.isScreenSharing && member.screenStream,
    );

    if (screenSharer) {
      setIsScreenShareMode(true);
      setScreenShareStream(screenSharer.screenStream!);
      setScreenShareMemberId(screenSharer.memberId);
    } else {
      setIsScreenShareMode(false);
      setScreenShareStream(null);
      setScreenShareMemberId(null);
    }
  }, [memberStreams]);

  return (
    <div className="h-full w-full bg-[#202124] flex items-center justify-center">
      {isScreenShareMode && screenShareStream ? (
        <ScreenShareMode
          screenShareStream={screenShareStream}
          screenShareMemberId={screenShareMemberId!}
          localStream={localStream}
          memberStreams={memberStreams}
          remoteMembers={remoteMembers}
          currentMemberId={currentMemberId}
          participantName={participantName}
        />
      ) : (
        <ConferenceMode
          localStream={localStream}
          memberStreams={memberStreams}
          remoteMembers={remoteMembers}
          currentMemberId={currentMemberId}
          participantName={participantName}
        />
      )}
    </div>
  );
}
