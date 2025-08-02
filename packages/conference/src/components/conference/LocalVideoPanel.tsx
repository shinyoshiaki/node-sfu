import { VideoPlayer } from "./video/VideoPlayer.js";

interface ScreenShare {
  isSharing: boolean;
  isSupported: boolean;
  error: string | null;
  screenStream: MediaStream | null;
  startSharing: () => Promise<void>;
  stopSharing: () => Promise<void>;
}

interface LocalVideoPanelProps {
  localStream: MediaStream | null;
  participantName?: string;
  screenShare: ScreenShare;
}

export function LocalVideoPanel({
  localStream,
  participantName,
  screenShare,
}: LocalVideoPanelProps) {
  const isScreenSharing = screenShare.isSharing && screenShare.screenStream;

  return (
    <div
      className={`lg:col-span-1 ${isScreenSharing ? "flex flex-col gap-2" : ""}`}
      style={{ maxHeight: "calc(100vh - 160px)" }}
    >
      {/* Local Camera Video */}
      <div
        className={`bg-gray-800 rounded-lg overflow-hidden relative ${
          isScreenSharing
            ? "flex-1 min-h-0" // Take remaining space when screen sharing
            : "h-64 lg:h-full" // Full height when not screen sharing
        }`}
      >
        <VideoPlayer stream={localStream} testId="local-video" muted={true} />
        <div
          data-testid="local-participant-name"
          className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded"
        >
          {participantName || "You"}
        </div>
      </div>

      {/* Local Screen Share Video */}
      {isScreenSharing && (
        <div className="bg-gray-800 rounded-lg overflow-hidden flex-1 min-h-0 relative">
          <VideoPlayer
            stream={screenShare.screenStream}
            testId="screen-share-video"
            muted={true}
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
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 0v10"
              />
            </svg>
            Your Screen
          </div>
        </div>
      )}
    </div>
  );
}
