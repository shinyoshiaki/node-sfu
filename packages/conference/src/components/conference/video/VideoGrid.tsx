import { useMemo } from "react";
import type { RemoteMember } from "../../../../../client/src/index.js";
import { VideoPlayer } from "./VideoPlayer.js";

interface MemberStream {
  memberId: string;
  stream: MediaStream;
  hasVideo: boolean;
  hasAudio: boolean;
  screenStream?: MediaStream;
  isScreenSharing?: boolean;
}

interface VideoGridProps {
  localStream: MediaStream | null;
  memberStreams: MemberStream[];
  remoteMembers: RemoteMember[];
  currentMemberId: string | null;
  participantName?: string;
}

function calculateGridSize(participantCount: number): {
  rows: number;
  cols: number;
} {
  if (participantCount <= 1) return { rows: 1, cols: 1 };
  if (participantCount <= 2) return { rows: 1, cols: 2 };
  if (participantCount <= 4) return { rows: 2, cols: 2 };
  if (participantCount <= 6) return { rows: 2, cols: 3 };
  if (participantCount <= 9) return { rows: 3, cols: 3 };
  if (participantCount <= 12) return { rows: 3, cols: 4 };
  if (participantCount <= 16) return { rows: 4, cols: 4 };
  return { rows: 5, cols: 5 };
}

export function VideoGrid({
  localStream,
  memberStreams,
  remoteMembers,
  currentMemberId,
  participantName,
}: VideoGridProps) {
  const participantCount = memberStreams.length + (localStream ? 1 : 0);
  const { rows, cols } = useMemo(
    () => calculateGridSize(participantCount),
    [participantCount],
  );

  // Arrange participants: remote members first, then local member at the bottom-right
  const arrangedParticipants = useMemo(() => {
    const participants: Array<{
      id: string;
      stream: MediaStream;
      name: string;
      isLocal: boolean;
      hasVideo: boolean;
      hasAudio: boolean;
    }> = [];

    // Add remote participants
    memberStreams.forEach((member) => {
      const remoteMember = remoteMembers.find(
        (rm) => rm.id === member.memberId,
      );
      participants.push({
        id: member.memberId,
        stream: member.stream,
        name: remoteMember?.name || "Participant",
        isLocal: false,
        hasVideo: member.hasVideo,
        hasAudio: member.hasAudio,
      });
    });

    // Add local participant at the end (will be placed at bottom-right)
    if (localStream && currentMemberId) {
      participants.push({
        id: currentMemberId,
        stream: localStream,
        name: participantName || "You",
        isLocal: true,
        hasVideo: localStream.getVideoTracks().length > 0,
        hasAudio: localStream.getAudioTracks().length > 0,
      });
    }

    return participants;
  }, [
    memberStreams,
    remoteMembers,
    localStream,
    currentMemberId,
    participantName,
  ]);

  return (
    <div
      className="h-full w-full p-4 grid gap-2"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
      }}
    >
      {arrangedParticipants.map((participant, index) => {
        const isLastPosition = index === arrangedParticipants.length - 1;
        const shouldPlaceAtBottomRight = participant.isLocal && isLastPosition;

        // Calculate remote video index properly
        const remoteParticipants = arrangedParticipants.filter(
          (p) => !p.isLocal,
        );
        const remoteIndex = remoteParticipants.findIndex(
          (p) => p.id === participant.id,
        );

        return (
          <div
            key={participant.id}
            className="relative bg-[#292a2d] rounded-lg overflow-hidden"
            style={
              shouldPlaceAtBottomRight && participantCount > 1
                ? {
                    gridColumn: cols,
                    gridRow: rows,
                  }
                : undefined
            }
          >
            <VideoPlayer
              stream={participant.stream}
              muted={participant.isLocal}
              className="w-full h-full object-cover"
              testId={
                participant.isLocal
                  ? "local-video"
                  : `remote-video-${remoteIndex}`
              }
            />

            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
              <div className="flex items-center justify-between">
                <span
                  className="text-white text-sm font-medium"
                  data-testid={
                    participant.isLocal
                      ? "local-participant-name"
                      : `remote-participant-name-${remoteIndex}`
                  }
                >
                  {participant.name} {participant.isLocal && "(You)"}
                </span>
                <div className="flex items-center gap-2">
                  {!participant.hasAudio && (
                    <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
