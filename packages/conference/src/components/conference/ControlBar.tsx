import { useState } from "react";

interface ScreenShare {
  isSharing: boolean;
  isSupported: boolean;
  error: string | null;
  screenStream: MediaStream | null;
  startSharing: () => Promise<void>;
  stopSharing: () => Promise<void>;
}

interface ControlBarProps {
  isCameraOn: boolean;
  isMicrophoneOn: boolean;
  screenShare: ScreenShare;
  unreadCount: number;
  onToggleCamera: () => void;
  onToggleMicrophone: () => void;
  onToggleChat: () => void;
  onLeaveRoom: () => void;
}

interface ControlButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  activeIcon?: React.ReactNode;
  label: string;
  testId: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  variant?: "default" | "danger";
  badge?: number;
}

function ControlButton({
  active,
  onClick,
  icon,
  activeIcon,
  label,
  testId,
  onMouseEnter,
  onMouseLeave,
  variant = "default",
  badge,
}: ControlButtonProps) {
  const getButtonStyles = () => {
    if (variant === "danger") {
      return "bg-[#ea4335] hover:bg-[#d33b2c]";
    }
    if (active) {
      return "bg-[#3c4043] hover:bg-[#5f6368]";
    }
    return "bg-[#ea4335] hover:bg-[#d33b2c]";
  };

  return (
    <div className="relative">
      <button
        data-testid={testId}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`relative p-4 rounded-full transition-all duration-150 ${getButtonStyles()}`}
        aria-label={label}
      >
        <div className="w-6 h-6 text-white">
          {active && activeIcon ? activeIcon : icon}
        </div>
        {badge !== undefined && badge > 0 && (
          <span
            data-testid="unread-count"
            className="absolute -top-1 -right-1 bg-[#ea4335] text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium"
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>
    </div>
  );
}

export function ControlBar({
  isCameraOn,
  isMicrophoneOn,
  screenShare,
  unreadCount,
  onToggleCamera,
  onToggleMicrophone,
  onToggleChat,
  onLeaveRoom,
}: ControlBarProps) {
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  const buttons = [
    {
      id: "microphone",
      testId: "microphone-toggle-btn",
      active: isMicrophoneOn,
      onClick: onToggleMicrophone,
      label: isMicrophoneOn ? "Turn off microphone" : "Turn on microphone",
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      ),
      activeIcon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
      ),
    },
    {
      id: "camera",
      testId: "camera-toggle-btn",
      active: isCameraOn,
      onClick: onToggleCamera,
      label: isCameraOn ? "Turn off camera" : "Turn on camera",
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18 16.5a1 1 0 01-1.447-.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      ),
      activeIcon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      ),
    },
  ];

  if (screenShare.isSupported) {
    buttons.push({
      id: "screen",
      testId: "screen-share-button",
      active: !screenShare.isSharing,
      onClick: () => {
        if (screenShare.isSharing) {
          screenShare.stopSharing();
        } else {
          screenShare.startSharing();
        }
      },
      label: screenShare.isSharing ? "Stop presenting" : "Present now",
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 0v10"
          />
        </svg>
      ),
      activeIcon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      ),
    });
  }

  return (
    <footer className="relative bg-[#202124] px-6 py-4">
      {/* Central control buttons */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-3">
          {buttons.map((button) => (
            <ControlButton
              key={button.id}
              {...button}
              onMouseEnter={() => setHoveredButton(button.id)}
              onMouseLeave={() => setHoveredButton(null)}
            />
          ))}
        </div>

        {/* Right-side controls */}
        <div className="absolute right-6 flex items-center gap-3">
          <button
            data-testid="chat-toggle-button"
            onClick={onToggleChat}
            onMouseEnter={() => setHoveredButton("chat")}
            onMouseLeave={() => setHoveredButton(null)}
            className="relative p-3 rounded-full transition-all duration-150 bg-[#3c4043] hover:bg-[#5f6368]"
            aria-label="Toggle chat"
          >
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            {unreadCount > 0 && (
              <span
                data-testid="unread-count"
                className="absolute -top-1 -right-1 bg-[#ea4335] text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {/* End call button */}
          <button
            data-testid="leave-room-btn"
            onClick={onLeaveRoom}
            onMouseEnter={() => setHoveredButton("end")}
            onMouseLeave={() => setHoveredButton(null)}
            className="p-4 rounded-full transition-all duration-150 bg-[#ea4335] hover:bg-[#d33b2c]"
            aria-label="Leave call"
          >
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Tooltips */}
      {hoveredButton && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 pointer-events-none">
          <div className="bg-gray-700 text-white text-sm px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
            {hoveredButton === "microphone" &&
              (isMicrophoneOn ? "Turn off microphone" : "Turn on microphone")}
            {hoveredButton === "camera" &&
              (isCameraOn ? "Turn off camera" : "Turn on camera")}
            {hoveredButton === "screen" &&
              (screenShare.isSharing ? "Stop presenting" : "Present now")}
            {hoveredButton === "chat" && "Chat with everyone"}
            {hoveredButton === "end" && "Leave call"}
          </div>
        </div>
      )}
    </footer>
  );
}
