import type { RemoteMember } from "../../../../../client/src/index.js";
import { VideoGrid } from "../video/VideoGrid.js";

interface MemberStream {
  memberId: string;
  stream: MediaStream;
  hasVideo: boolean;
  hasAudio: boolean;
  screenStream?: MediaStream;
  isScreenSharing?: boolean;
}

interface ConferenceModeProps {
  localStream: MediaStream | null;
  memberStreams: MemberStream[];
  remoteMembers: RemoteMember[];
  currentMemberId: string | null;
  participantName?: string;
}

export function ConferenceMode({
  localStream,
  memberStreams,
  remoteMembers,
  currentMemberId,
  participantName,
}: ConferenceModeProps) {
  return (
    <VideoGrid
      localStream={localStream}
      memberStreams={memberStreams}
      remoteMembers={remoteMembers}
      currentMemberId={currentMemberId}
      participantName={participantName}
    />
  );
}
