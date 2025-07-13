import { useEffect, useRef } from "react";

interface ConferencePageProps {
  roomId: string;
  localStream: MediaStream | null;
  remoteStreams: MediaStream[];
  connectionStatus: string;
  onLeaveRoom: () => void;
}

export function ConferencePage({
  roomId,
  localStream,
  remoteStreams,
  connectionStatus,
  onLeaveRoom,
}: ConferencePageProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-white font-semibold">Conference Room</h1>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-300">Room ID:</span>
              <code className="text-xs bg-gray-700 text-gray-200 px-2 py-1 rounded">
                {roomId}
              </code>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span
              data-testid="connection-status"
              className={`text-xs px-2 py-1 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-green-900 text-green-200"
                  : "bg-yellow-900 text-yellow-200"
              }`}
            >
              {connectionStatus}
            </span>
            <button
              data-testid="leave-room-btn"
              onClick={onLeaveRoom}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Leave
            </button>
          </div>
        </div>
      </header>

      {/* Main Video Area */}
      <main className="flex-1 p-4">
        <div className="h-full grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Remote Videos - Main Area */}
          <div className="lg:col-span-3">
            <div
              data-testid="remote-videos"
              className="h-full grid gap-4"
              style={{
                gridTemplateColumns:
                  remoteStreams.length <= 1
                    ? "1fr"
                    : remoteStreams.length <= 4
                      ? "repeat(2, 1fr)"
                      : "repeat(3, 1fr)",
              }}
            >
              {remoteStreams.length === 0 ? (
                <div className="flex items-center justify-center bg-gray-800 rounded-lg border-2 border-dashed border-gray-600">
                  <div className="text-center text-gray-400">
                    <svg
                      className="w-16 h-16 mx-auto mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      role="img"
                      aria-label="People icon"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    <p>Waiting for participants to join...</p>
                  </div>
                </div>
              ) : (
                remoteStreams.map((stream, index) => (
                  <div
                    key={stream.id}
                    className="relative bg-gray-800 rounded-lg overflow-hidden"
                  >
                    <video
                      data-testid={`remote-video-${index}`}
                      ref={(el) => {
                        if (el) el.srcObject = stream;
                      }}
                      autoPlay
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                      Participant {index + 1}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Local Video - Side Panel */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-lg overflow-hidden h-64 lg:h-full relative">
              <video
                ref={localVideoRef}
                data-testid="local-video"
                autoPlay
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                You
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Control Bar */}
      <footer className="bg-gray-800 border-t border-gray-700 px-4 py-4">
        <div className="flex items-center justify-center gap-4">
          <button className="p-3 bg-gray-700 text-white rounded-full hover:bg-gray-600 transition-colors">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              role="img"
              aria-label="Microphone icon"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </button>

          <button className="p-3 bg-gray-700 text-white rounded-full hover:bg-gray-600 transition-colors">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              role="img"
              aria-label="Video camera icon"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </button>

          <button className="p-3 bg-gray-700 text-white rounded-full hover:bg-gray-600 transition-colors">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              role="img"
              aria-label="Share screen icon"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
              />
            </svg>
          </button>
        </div>
      </footer>
    </div>
  );
}
