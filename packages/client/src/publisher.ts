import { v4 as uuidv4 } from "uuid";
import { Event } from "../../../submodules/werift/packages/common/src/event.js";
import { PromiseQueue } from "../../../submodules/werift/packages/common/src/promise.js";
import { createDataChannelLabel } from "../../core/src/dataPublication.js";
import type { ConnectionManager } from "./connectionManager.js";
import { DataPublication } from "./dataPublication.js";
import type { JsonRpc } from "./imports/json-rpc.js";
import { MediaPublication } from "./mediaPublication.js";
import type { MediaStreamTrackLike } from "./type.js";

interface PendingDataPublication {
  resolve: (publication: DataPublication) => void;
  reject: (error: Error) => void;
  publication: DataPublication;
}

interface PendingMediaPublication {
  resolve: (publication: MediaPublication) => void;
  reject: (error: Error) => void;
  track: MediaStreamTrackLike;
  metadata: Record<string, any>;
}

export class Publisher {
  private dataPublications = new Map<string, DataPublication>();
  private mediaPublications = new Map<string, MediaPublication>();
  private pendingDataPublications = new Map<string, PendingDataPublication>();
  private pendingMediaPublications = new Map<string, PendingMediaPublication>();
  private queue = new PromiseQueue();

  // Events
  readonly onPublishOfferNeeded = new Event<
    [string, RTCSessionDescriptionInit]
  >();
  readonly onPublicationReady = new Event<[string]>();

  constructor(
    private connectionManager: ConnectionManager,
    private jsonRpc?: JsonRpc,
  ) {}

  setJsonRpc(jsonRpc: JsonRpc): void {
    this.jsonRpc = jsonRpc;
  }

  async publish(metadata: Record<string, any> = {}): Promise<DataPublication> {
    console.log("Publishing data with metadata:", metadata);

    await this.connectionManager.waitForConnection();

    const publicationId = uuidv4();
    const label = createDataChannelLabel(publicationId, metadata);

    return new Promise((resolve, reject) => {
      // Create the data channel and publication first
      const channel = this.connectionManager
        .getPeerConnection()
        .createDataChannel(label, {
          ordered: true,
        });

      const publication = new DataPublication(publicationId, channel, metadata);
      this.dataPublications.set(publicationId, publication);

      // Set up the timeout and subscription
      const timeout = setTimeout(() => {
        this.pendingDataPublications.delete(publicationId);
        reject(new Error(`Publication ready timeout for ${publicationId}`));
      }, 10000);

      this.pendingDataPublications.set(publicationId, {
        resolve: (resolvedPublication: DataPublication) => {
          clearTimeout(timeout);
          resolve(resolvedPublication);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
        publication,
      });
    });
  }

  async unpublish(publicationId: string): Promise<void> {
    const publication = this.dataPublications.get(publicationId);
    if (!publication) {
      throw new Error(`Data publication ${publicationId} not found`);
    }

    // Send unpublish request to server first
    console.log(`Unpublishing data: ${publicationId}`);
    if (!this.jsonRpc) {
      throw new Error("JsonRpc not initialized");
    }

    try {
      const response = await this.jsonRpc.request("unpublishData", {
        publicationId: publicationId,
      });

      console.log(`UnpublishData request successful:`, response);

      // Only clean up locally if server confirms success
      publication.close();
      this.dataPublications.delete(publicationId);
    } catch (error) {
      console.error(`UnpublishData request failed:`, error);
      throw new Error(
        `Failed to unpublish data: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async publishMedia(
    track: MediaStreamTrack | MediaStreamTrackLike,
    metadata: Record<string, any> = {},
  ): Promise<MediaPublication> {
    console.log(
      `Publishing media track: ${track.kind} with metadata:`,
      metadata,
    );

    await this.connectionManager.waitForConnection();

    const publicationId = uuidv4();

    return new Promise(async (resolve, reject) => {
      let resolved = false;

      const pendingResolve = (publication: MediaPublication) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(publication);
        }
      };

      const pendingReject = (error: Error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(error);
        }
      };

      this.pendingMediaPublications.set(publicationId, {
        resolve: pendingResolve,
        reject: pendingReject,
        track: track as MediaStreamTrackLike,
        metadata: metadata,
      });

      const timeout = setTimeout(() => {
        if (!resolved) {
          this.pendingMediaPublications.delete(publicationId);
          pendingReject(
            new Error(`Media publication ready timeout for ${publicationId}`),
          );
        }
      }, 10000);

      try {
        console.log(
          `Sending publish request for ${publicationId} with media kind ${track.kind}`,
        );
        if (!this.jsonRpc) {
          throw new Error("JsonRpc not initialized");
        }
        const response = await this.jsonRpc.request("publishMedia", {
          publicationId: publicationId,
          mediaKind: track.kind,
          metadata: metadata,
        });

        console.log(`PublishMedia request successful:`, response);
      } catch (error) {
        console.error(`PublishMedia request failed:`, error);
        this.pendingMediaPublications.delete(publicationId);
        pendingReject(error as Error);
      }
    });
  }

  async unpublishMedia(publicationId: string): Promise<void> {
    const publication = this.mediaPublications.get(publicationId);
    if (!publication) {
      throw new Error(`Media publication ${publicationId} not found`);
    }

    // Send unpublish request to server first
    console.log(`Unpublishing media: ${publicationId}`);
    if (!this.jsonRpc) {
      throw new Error("JsonRpc not initialized");
    }

    try {
      const response = await this.jsonRpc.request("unpublishMedia", {
        publicationId: publicationId,
      });

      console.log(`UnpublishMedia request successful:`, response);

      // Only clean up locally if server confirms success
      // Stop the track if it exists
      if (publication.track) {
        publication.track?.stop?.();
      }

      // Remove from local publications
      this.mediaPublications.delete(publicationId);
    } catch (error) {
      console.error(`UnpublishMedia request failed:`, error);
      throw new Error(
        `Failed to unpublish media: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  getPublication(publicationId: string): DataPublication | undefined {
    return this.dataPublications.get(publicationId);
  }

  getMediaPublication(publicationId: string): MediaPublication | undefined {
    return this.mediaPublications.get(publicationId);
  }

  getPublications(): DataPublication[] {
    return Array.from(this.dataPublications.values());
  }

  getMediaPublications(): MediaPublication[] {
    return Array.from(this.mediaPublications.values());
  }

  async handlePublishOffer(
    publicationId: string,
    offer: RTCSessionDescriptionInit,
  ): Promise<void> {
    console.log(`Handling publish offer for ${publicationId}`);
    const pending = this.pendingMediaPublications.get(publicationId);
    if (!pending) {
      console.error(`No pending media publication found for ${publicationId}`);
      return;
    }

    const pc = this.connectionManager.getPeerConnection();
    try {
      console.log(
        { memberId: this.connectionManager.memberId },
        `Adding track for publication ${publicationId}`,
        pending.track,
        pending.metadata,
      );

      await this.connectionManager.setRemoteDescription(offer);
      const t = pc
        .getTransceivers()
        .sort((a, b) => Number(a.mid) - Number(b.mid))
        .filter((t) => t.direction === "recvonly")
        .at(-1);
      if (t) {
        console.log(
          `Replacing track for transceiver ${t.mid} for publication ${publicationId} direction: ${t.direction}`,
        );
        t.direction = "sendonly";
        await t.sender.replaceTrack(pending.track as MediaStreamTrack);
      } else {
        console.error(
          `No transceiver found for publication ${publicationId} to replace track`,
        );
      }

      const answer = await this.connectionManager.createAndSetAnswer();
      console.log(`Created answer for publication ${publicationId}`);

      if (!this.jsonRpc) {
        throw new Error("JsonRpc not initialized");
      }

      try {
        const response = await this.jsonRpc.request("answer", {
          publicationId: publicationId,
          answer: {
            type: answer.type,
            sdp: answer.sdp,
          },
        });

        console.log(
          `Answer request successful for publication ${publicationId}:`,
          response,
        );
        // No longer need the timeout since we now have proper confirmation via request/response
      } catch (error) {
        console.error(
          `Answer request failed for publication ${publicationId}:`,
          error,
        );
        throw error;
      }

      const publication = new MediaPublication(
        publicationId,
        pending.track,
        pending.metadata,
      );
      this.mediaPublications.set(publicationId, publication);

      pending.resolve(publication);
      this.pendingMediaPublications.delete(publicationId);
    } catch (error) {
      console.error(
        `Failed to handle publish offer for ${publicationId} memberId:${this.connectionManager.memberId}`,
        error,
      );
      pending.reject(error as Error);
      this.pendingMediaPublications.delete(publicationId);
    }
  }

  async handlePublicationReady(publicationId: string) {
    const pending = this.pendingDataPublications.get(publicationId);
    if (pending) {
      this.pendingDataPublications.delete(publicationId);
      await pending.publication._waitForOpen(5000);
      pending.resolve(pending.publication);
    }
    this.onPublicationReady.execute(publicationId);
  }

  handleDataUnpublished(publicationId: string): void {
    const publication = this.dataPublications.get(publicationId);
    if (publication) {
      publication.close();
      this.dataPublications.delete(publicationId);
      console.log(`Removed local data publication: ${publicationId}`);
    }
  }

  close(): void {
    // Close data publications
    for (const publication of this.dataPublications.values()) {
      publication.close();
    }
    this.dataPublications.clear();

    // Clear media publications
    this.mediaPublications.clear();

    // Reject pending publications
    for (const pending of this.pendingDataPublications.values()) {
      pending.reject(new Error("Publisher closed"));
    }
    this.pendingDataPublications.clear();

    for (const pending of this.pendingMediaPublications.values()) {
      pending.reject(new Error("Publisher closed"));
    }
    this.pendingMediaPublications.clear();

    // Complete events
    this.onPublishOfferNeeded.complete();
    this.onPublicationReady.complete();
  }
}
