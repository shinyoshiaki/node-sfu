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

interface ParticipantsSidebarProps {
  localStream: MediaStream | null;
  memberStreams: MemberStream[];
  remoteMembers: RemoteMember[];
  currentMemberId: string | null;
  participantName?: string;
  presenterMemberId: string;
  isMobile: boolean;
}

export function ParticipantsSidebar({
  localStream,
  memberStreams,
  remoteMembers,
  currentMemberId,
  participantName,
  presenterMemberId,
  isMobile,
}: ParticipantsSidebarProps) {
  const participants = useMemo(() => {
    const participantList: Array<{
      id: string;
      stream: MediaStream;
      name: string;
      isLocal: boolean;
      isPresenter: boolean;
      hasVideo: boolean;
      hasAudio: boolean;
    }> = [];

    // Add presenter first if they have a camera stream
    const presenterStream = memberStreams.find(
      (m) => m.memberId === presenterMemberId,
    );
    if (presenterStream) {
      const presenter = remoteMembers.find((rm) => rm.id === presenterMemberId);
      participantList.push({
        id: presenterMemberId,
        stream: presenterStream.stream,
        name: presenter?.name || "Presenter",
        isLocal: false,
        isPresenter: true,
        hasVideo: presenterStream.hasVideo,
        hasAudio: presenterStream.hasAudio,
      });
    } else if (presenterMemberId === currentMemberId && localStream) {
      // Local user is presenting
      participantList.push({
        id: currentMemberId,
        stream: localStream,
        name: participantName || "You",
        isLocal: true,
        isPresenter: true,
        hasVideo: localStream.getVideoTracks().length > 0,
        hasAudio: localStream.getAudioTracks().length > 0,
      });
    }

    // Add other remote participants
    memberStreams.forEach((member) => {
      if (member.memberId !== presenterMemberId) {
        const remoteMember = remoteMembers.find(
          (rm) => rm.id === member.memberId,
        );
        participantList.push({
          id: member.memberId,
          stream: member.stream,
          name: remoteMember?.name || "Participant",
          isLocal: false,
          isPresenter: false,
          hasVideo: member.hasVideo,
          hasAudio: member.hasAudio,
        });
      }
    });

    // Add local participant at the end if not presenting
    if (
      localStream &&
      currentMemberId &&
      presenterMemberId !== currentMemberId
    ) {
      participantList.push({
        id: currentMemberId,
        stream: localStream,
        name: participantName || "You",
        isLocal: true,
        isPresenter: false,
        hasVideo: localStream.getVideoTracks().length > 0,
        hasAudio: localStream.getAudioTracks().length > 0,
      });
    }

    return participantList;
  }, [
    memberStreams,
    remoteMembers,
    localStream,
    currentMemberId,
    participantName,
    presenterMemberId,
  ]);

  const containerClass = isMobile
    ? "flex flex-row gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent h-32"
    : "flex flex-col gap-2 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent w-80";

  const itemClass = isMobile ? "flex-shrink-0 w-32 h-full" : "w-full h-44";

  return (
    <div className={containerClass}>
      {participants.map((participant, index) => {
        // Calculate indices for test-id
        const remoteParticipants = participants.filter((p) => !p.isLocal);
        const remoteIndex = remoteParticipants.findIndex(
          (p) => p.id === participant.id,
        );

        return (
          <div
            key={participant.id}
            className={`${itemClass} bg-[#292a2d] rounded-lg overflow-hidden relative ${
              participant.isPresenter ? "ring-2 ring-blue-500" : ""
            }`}
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
                  className="text-white text-xs font-medium truncate"
                  data-testid={
                    participant.isLocal
                      ? "local-participant-name"
                      : `remote-participant-name-${remoteIndex}`
                  }
                >
                  {participant.name}
                  {participant.isLocal && " (You)"}
                  {participant.isPresenter && " 🎥"}
                </span>
                {!participant.hasAudio && (
                  <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-3 h-3 text-white"
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
        );
      })}
    </div>
  );
}
