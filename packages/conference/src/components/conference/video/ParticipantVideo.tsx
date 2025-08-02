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

interface ParticipantVideoProps {
  memberStream: MemberStream;
  member: RemoteMember | undefined;
  index: number;
  isInSidebar?: boolean;
}

export function ParticipantVideo({
  memberStream,
  member,
  index,
  isInSidebar = false,
}: ParticipantVideoProps) {
  // In sidebar mode, show only camera video (screen share is shown in main area)
  const showScreenShare =
    !isInSidebar && memberStream.isScreenSharing && memberStream.screenStream;

  return (
    <div
      key={`${memberStream.memberId}-container`}
      className={isInSidebar ? "space-y-1" : "space-y-2"}
    >
      {/* Camera video - always render if member exists, even without video */}
      <div
        className={`relative bg-gray-800 rounded-lg overflow-hidden ${isInSidebar ? "h-24" : ""}`}
      >
        <VideoPlayer
          stream={memberStream.stream}
          testId={`remote-video-${index}`}
          className={isInSidebar ? "w-full h-full object-cover" : ""}
        />
        <div
          className={`absolute flex items-center gap-2 ${isInSidebar ? "top-1 left-1" : "bottom-2 left-2"}`}
        >
          <div
            data-testid={`remote-participant-name-${index}`}
            className={`bg-black bg-opacity-50 text-white px-2 py-1 rounded ${isInSidebar ? "text-xs px-1 py-0.5" : "text-xs"}`}
          >
            {member?.name || `Participant ${index + 1}`}
          </div>
          {memberStream.hasAudio && (
            <div
              className={`bg-green-600 bg-opacity-80 text-white p-1 rounded ${isInSidebar ? "p-0.5" : ""}`}
            >
              <svg
                className={`fill-none stroke-current ${isInSidebar ? "w-2 h-2" : "w-3 h-3"}`}
                viewBox="0 0 24 24"
                role="img"
                aria-label="Audio active"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </div>
          )}
          {/* Show screen sharing indicator when they're sharing but it's displayed in main area */}
          {isInSidebar && memberStream.isScreenSharing && (
            <div className="bg-blue-600 bg-opacity-80 text-white p-0.5 rounded">
              <svg
                className="w-2 h-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                role="img"
                aria-label="Screen sharing"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 0v10"
                />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Screen share video - only show in grid mode */}
      {showScreenShare && (
        <div className="relative bg-gray-800 rounded-lg overflow-hidden">
          <VideoPlayer
            stream={memberStream.screenStream}
            testId={`remote-screen-share-${index}`}
          />
          <div className="absolute bottom-2 left-2 bg-blue-600 bg-opacity-80 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              role="img"
              aria-label="Screen sharing"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 0v10"
              />
            </svg>
            {member?.name || `Participant ${index + 1}`} - Screen
          </div>
        </div>
      )}
    </div>
  );
}
