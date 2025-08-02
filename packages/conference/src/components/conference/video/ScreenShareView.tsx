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

interface ScreenShareViewProps {
  memberStream: MemberStream;
  member: RemoteMember | undefined;
  participantIndex: number;
}

export function ScreenShareView({
  memberStream,
  member,
  participantIndex,
}: ScreenShareViewProps) {
  if (!memberStream.screenStream) {
    return null;
  }

  return (
    <div
      className="h-full flex flex-col bg-gray-900 rounded-lg overflow-hidden"
      style={{ maxHeight: "calc(100vh - 120px)" }}
    >
      {/* Screen share video */}
      <div className="flex-1 relative">
        <VideoPlayer
          stream={memberStream.screenStream}
          testId={`remote-screen-share-${participantIndex}`}
          className="w-full h-full object-contain"
        />

        {/* Screen share indicator */}
        <div className="absolute top-2 left-2 bg-blue-600 bg-opacity-90 text-white px-2 py-1 rounded-lg flex items-center gap-2 text-sm">
          <svg
            className="w-4 h-4"
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
          <span className="font-medium">
            {member?.name || "Participant"} is sharing their screen
          </span>
        </div>
      </div>

      {/* Presenter's camera view (optional) */}
      {memberStream.hasVideo && (
        <div className="absolute bottom-2 left-2 w-24 h-24 bg-gray-800 rounded-lg overflow-hidden">
          <VideoPlayer
            stream={memberStream.stream}
            testId="presenter-camera"
            className="w-full h-full object-cover"
          />
          <div className="absolute top-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 py-0.5 rounded">
            {member?.name || "Presenter"}
          </div>
        </div>
      )}
    </div>
  );
}
