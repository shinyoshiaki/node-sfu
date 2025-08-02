import { useState } from "react";
import { LoadingOverlay } from "../ui/LoadingOverlay.js";

interface HomePageProps {
  onCreateRoom: (participantName?: string) => Promise<string>;
  onJoinRoom: (roomId: string, participantName?: string) => void;
}

export function HomePage({ onCreateRoom, onJoinRoom }: HomePageProps) {
  const [roomId, setRoomId] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const handleCreateRoom = async () => {
    setIsCreating(true);
    try {
      const newRoomId = await onCreateRoom(participantName || undefined);
      await onJoinRoom(newRoomId, participantName || undefined);
      // オーバーレイは会議画面に遷移した後に自然に消える
    } catch (error) {
      console.error("Failed to create room:", error);
      alert("Failed to create room. Please try again.");
      setIsCreating(false); // エラー時のみオーバーレイを消す
    }
  };

  const handleJoinRoom = async () => {
    if (!roomId.trim()) return;

    setIsJoining(true);
    try {
      await onJoinRoom(roomId.trim(), participantName || undefined);
      // オーバーレイは会議画面に遷移した後に自然に消える
    } catch (error) {
      console.error("Failed to join room:", error);
      alert("Failed to join room. Please try again.");
      setIsJoining(false); // エラー時のみオーバーレイを消す
    }
  };

  return (
    <div className="min-h-screen bg-[#202124] flex items-center justify-center relative">
      <LoadingOverlay
        isVisible={isCreating || isJoining}
        title={isCreating ? "Setting up your meeting" : "Joining meeting"}
        message="Please wait while we prepare your conference room..."
      />

      <div className="max-w-lg w-full mx-4">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="mb-6">
            <div className="w-20 h-20 bg-[#1a73e8] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-10 h-10 text-white"
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
            </div>
          </div>
          <h1 className="text-4xl font-normal text-[#e8eaed] mb-3">
            Ready to connect?
          </h1>
          <p className="text-[#9aa0a6] text-lg">
            Start or join a high-quality video meeting
          </p>
        </div>

        {/* Main Actions */}
        <div className="bg-[#292a2d] rounded-xl shadow-lg p-8 space-y-6">
          {/* Participant Name */}
          <div className="space-y-3">
            <label
              htmlFor="participant-name"
              className="block text-sm font-medium text-[#e8eaed]"
            >
              Your name (optional)
            </label>
            <input
              id="participant-name"
              data-testid="participant-name-input"
              type="text"
              placeholder="Enter your name"
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              className="w-full px-4 py-4 bg-[#3c4043] border border-[#5f6368] rounded-lg text-[#e8eaed] placeholder-[#9aa0a6] focus:ring-2 focus:ring-[#1a73e8] focus:border-[#1a73e8] outline-none transition-all"
            />
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            {/* Create Room */}
            <button
              data-testid="create-room-btn"
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] disabled:bg-[#5f6368] disabled:cursor-not-allowed transition-all duration-200 font-medium"
            >
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
              {isCreating ? "Creating meeting..." : "Start new meeting"}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#5f6368]" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-[#292a2d] text-[#9aa0a6]">or</span>
              </div>
            </div>

            {/* Join Room */}
            <div className="space-y-3">
              <input
                data-testid="room-id-input"
                type="text"
                placeholder="Enter meeting ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full px-4 py-4 bg-[#3c4043] border border-[#5f6368] rounded-lg text-[#e8eaed] placeholder-[#9aa0a6] focus:ring-2 focus:ring-[#1a73e8] focus:border-[#1a73e8] outline-none transition-all"
                onKeyPress={(e) => e.key === "Enter" && handleJoinRoom()}
              />
              <button
                data-testid="join-room-btn"
                onClick={handleJoinRoom}
                disabled={!roomId.trim() || isJoining}
                className="w-full px-6 py-4 bg-[#3c4043] text-[#e8eaed] rounded-lg hover:bg-[#5f6368] disabled:bg-[#292a2d] disabled:text-[#9aa0a6] disabled:cursor-not-allowed transition-all duration-200 font-medium border border-[#5f6368]"
              >
                {isJoining ? "Joining meeting..." : "Join meeting"}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-[#9aa0a6]">
          Secure video conferencing powered by WebRTC
        </div>
      </div>
    </div>
  );
}
