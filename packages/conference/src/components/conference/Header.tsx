interface HeaderProps {
  roomId: string;
  connectionStatus: string;
  onLeaveRoom: () => void;
}

export function Header({ roomId, connectionStatus, onLeaveRoom }: HeaderProps) {
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      // Simple feedback - could be enhanced with a toast notification
    } catch (err) {
      console.error("Failed to copy room ID: ", err);
    }
  };

  return (
    <header className="bg-[#202124] border-b border-[#3c4043] px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Left side - Meeting ID */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <svg
              className="w-6 h-6 text-[#1a73e8]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <div className="flex items-center gap-2">
              <span className="text-[#e8eaed] font-medium">Meeting ID:</span>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-3 py-1 bg-[#3c4043] hover:bg-[#5f6368] rounded-lg transition-colors group"
                title="Click to copy meeting ID"
              >
                <code className="text-sm text-[#e8eaed] font-mono">
                  {roomId}
                </code>
                <svg
                  className="w-4 h-4 text-[#9aa0a6] group-hover:text-[#e8eaed]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Right side - Connection Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-green-500"
                  : "bg-yellow-500"
              }`}
            />
            <span
              data-testid="connection-status"
              className="text-sm text-[#9aa0a6] capitalize"
            >
              {connectionStatus}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
