import { useEffect, useRef } from "react";

interface VideoPlayerProps {
  stream: MediaStream | null;
  autoPlay?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  className?: string;
  testId?: string;
}

export function VideoPlayer({
  stream,
  autoPlay = true,
  muted = false,
  playsInline = true,
  className = "w-full h-full object-cover",
  testId,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      data-testid={testId}
      autoPlay={autoPlay}
      muted={muted}
      playsInline={playsInline}
      className={className}
    />
  );
}
