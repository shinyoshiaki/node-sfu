import type { RemoteMember } from "../../../../client/src/index.js";
import { ParticipantVideo } from "./video/ParticipantVideo.js";
import { ScreenShareView } from "./video/ScreenShareView.js";

interface MemberStream {
  memberId: string;
  stream: MediaStream;
  hasVideo: boolean;
  hasAudio: boolean;
  screenStream?: MediaStream;
  isScreenSharing?: boolean;
}

interface RemoteVideoGridProps {
  memberStreams: MemberStream[];
  remoteMembers: RemoteMember[];
}

export function RemoteVideoGrid({
  memberStreams,
  remoteMembers,
}: RemoteVideoGridProps) {
  // Find the latest screen share (最新の画面共有を検出)
  const screenSharingMembers = memberStreams.filter(
    (ms) => ms.isScreenSharing && ms.screenStream,
  );
  const latestScreenShare =
    screenSharingMembers.length > 0
      ? screenSharingMembers[screenSharingMembers.length - 1]
      : null;

  // Determine if we're in screen share mode
  const isScreenShareMode = latestScreenShare !== null;

  if (isScreenShareMode && latestScreenShare) {
    // Screen Share Mode: Show main screen share + participants on the right
    const mainScreenShareMember = remoteMembers.find(
      (m) => m.id === latestScreenShare.memberId,
    );
    const otherMembers = memberStreams.filter(
      (ms) => ms.memberId !== latestScreenShare.memberId,
    );

    // Find the original index of the screen sharing participant
    const screenShareParticipantIndex = memberStreams.findIndex(
      (ms) => ms.memberId === latestScreenShare.memberId,
    );

    return (
      <div className="lg:col-span-3">
        <div className="h-full flex gap-4" data-testid="remote-videos">
          {/* Main screen share area */}
          <div className="flex-1">
            <ScreenShareView
              memberStream={latestScreenShare}
              member={mainScreenShareMember}
              participantIndex={screenShareParticipantIndex}
            />
          </div>

          {/* Right sidebar with other participants */}
          {otherMembers.length > 0 && (
            <div
              className="w-64 flex flex-col gap-2 overflow-y-auto"
              style={{ maxHeight: "calc(100% - 80px)" }}
            >
              {otherMembers.map((memberStream, index) => {
                const member = remoteMembers.find(
                  (m) => m.id === memberStream.memberId,
                );
                return (
                  <div
                    key={`${memberStream.memberId}-sidebar`}
                    className="flex-shrink-0"
                  >
                    <ParticipantVideo
                      memberStream={memberStream}
                      member={member}
                      index={index}
                      isInSidebar={true}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Grid Mode: Traditional grid layout when no screen sharing
  return (
    <div className="lg:col-span-3">
      <div
        data-testid="remote-videos"
        className="h-full grid gap-4"
        style={{
          gridTemplateColumns:
            memberStreams.length <= 1
              ? "1fr"
              : memberStreams.length <= 4
                ? "repeat(2, 1fr)"
                : "repeat(3, 1fr)",
        }}
      >
        {memberStreams.length === 0 ? (
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
          <>
            {memberStreams.map((memberStream, index) => {
              const member = remoteMembers.find(
                (m) => m.id === memberStream.memberId,
              );
              return (
                <ParticipantVideo
                  key={`${memberStream.memberId}-container`}
                  memberStream={memberStream}
                  member={member}
                  index={index}
                  isInSidebar={false}
                />
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
