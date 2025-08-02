import { useCallback, useRef, useState } from "react";
import type { Client } from "../../../client/src/index.js";

interface UseScreenShareReturn {
  isSharing: boolean;
  isSupported: boolean;
  error: string | null;
  screenStream: MediaStream | null;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => Promise<void>;
}

export function useScreenShare(
  client: Client | null,
  debugMode: boolean = false,
): UseScreenShareReturn {
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const screenPublicationRef = useRef<any | null>(null);

  // Check if screen sharing is supported
  const isSupported = Boolean(
    debugMode ||
      (navigator.mediaDevices && "getDisplayMedia" in navigator.mediaDevices),
  );

  const getScreenShareStream = useCallback(async (): Promise<MediaStream> => {
    if (debugMode) {
      // In debug mode, use camera as screen share for testing
      return navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
      });
    } else {
      // Real screen sharing
      return navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false, // Start with video only
      });
    }
  }, [debugMode]);

  const startScreenShare = useCallback(async () => {
    if (!client || !isSupported) {
      setError("Screen sharing not supported or client not available");
      return;
    }

    try {
      setError(null);

      // Get screen share stream
      const stream = await getScreenShareStream();
      const videoTrack = stream.getVideoTracks()[0];

      if (!videoTrack) {
        throw new Error("No video track available in screen share stream");
      }

      // Publish with screen share metadata
      const screenShareMetadata = {
        source: "screen",
        deviceType: "display",
        captureType: "screen",
        ...(debugMode && { debugMode: true }),
      };

      const publication = await client.publishMedia(
        videoTrack,
        screenShareMetadata,
      );
      screenPublicationRef.current = publication;

      setScreenStream(stream);
      setIsSharing(true);

      // Handle stream ending (user stops sharing)
      videoTrack.addEventListener("ended", () => {
        stopScreenShare();
      });

      console.log("Screen sharing started:", publication.publicationId);
    } catch (err) {
      console.error("Failed to start screen sharing:", err);
      setError(
        err instanceof Error ? err.message : "Failed to start screen sharing",
      );
    }
  }, [client, isSupported, getScreenShareStream, debugMode]);

  const stopScreenShare = useCallback(async () => {
    if (!client || !isSharing) return;

    try {
      setError(null);

      // Unpublish screen share
      if (screenPublicationRef.current) {
        await client.unpublishMedia(screenPublicationRef.current.publicationId);
        screenPublicationRef.current = null;
      }

      // Stop all tracks in the screen stream
      if (screenStream) {
        screenStream.getTracks().forEach((track) => track.stop());
        setScreenStream(null);
      }

      setIsSharing(false);
      console.log("Screen sharing stopped");
    } catch (err) {
      console.error("Failed to stop screen sharing:", err);
      setError(
        err instanceof Error ? err.message : "Failed to stop screen sharing",
      );
    }
  }, [client, isSharing, screenStream]);

  return {
    isSharing,
    isSupported,
    error,
    screenStream,
    startScreenShare,
    stopScreenShare,
  };
}
