import { v4 as uuidv4 } from "uuid";
import { MediaStream } from "../../../submodules/werift/packages/webrtc/src/index.js";
import type { RTCSessionDescriptionInit } from "../../../submodules/werift/packages/webrtc/src/index.js";
import type { DataSubscription } from "./dataSubscription.js";
import type { MediaPublication } from "./mediaPublication.js";
import type { MediaSubscription } from "./mediaSubscription.js";
import { Member } from "./member.js";

export class Room {
  readonly roomId: string;
  private members: Map<string, Member> = new Map();

  constructor() {
    this.roomId = uuidv4();
  }

  async join(): Promise<{
    member: Member;
    offerSdp: RTCSessionDescriptionInit;
  }> {
    const member = new Member();
    this.members.set(member.memberId, member);

    // Set up event listeners for dependency injection
    member.onDataPublicationReady.subscribe(
      (publicationId, publisherMemberId) => {
        this.broadcastPublicationReady(publicationId, publisherMemberId);
      },
    );

    member.onMediaPublicationReady.subscribe(
      (publicationId, publisherMemberId) => {
        this.onMediaPublicationReady(publicationId, publisherMemberId);
      },
    );

    member.onSubscriptionForwardingRequest.subscribe(
      (publicationId, subscription) => {
        this.setupSubscriptionForwarding(publicationId, subscription);
      },
    );

    member.onExistingPublicationsRequest.subscribe(() => {
      this.sendExistingPublications(member);
    });

    member.onMediaSubscriptionRequest.subscribe(
      (publicationId, subscriptionId, subscription) => {
        this.setupMediaSubscriptionForwarding(
          publicationId,
          subscriptionId,
          subscription,
        );
      },
    );

    // Listen for member disconnection
    member.onDisconnected.subscribe((disconnectedMemberId) => {
      console.log(
        `Member ${disconnectedMemberId} disconnected, removing from room`,
      );
      // Check if member still exists before removing to avoid double removal
      if (this.members.has(disconnectedMemberId)) {
        this.removeMember(disconnectedMemberId);
      }
    });

    const offerSdp = await member.createOffer();

    return { member, offerSdp };
  }

  removeMember(memberId: string): void {
    const member = this.members.get(memberId);
    if (member) {
      // Broadcast member left event to all remaining members
      this.broadcastMemberLeft(memberId);

      // Remove member from map BEFORE cleanup to prevent duplicate removal
      // from disconnect handlers triggered by cleanup
      this.members.delete(memberId);
      member.cleanup();
    }
  }

  private broadcastMemberLeft(memberId: string): void {
    const message = {
      type: "memberLeft",
      payload: {
        memberId: memberId,
      },
    };

    // Broadcast to all members except the one that's leaving
    for (const [currentMemberId, member] of this.members) {
      if (currentMemberId !== memberId) {
        member.sendControlMessage(message);
      }
    }
  }

  getMember(memberId: string): Member | undefined {
    return this.members.get(memberId);
  }

  getMembers(): Member[] {
    return Array.from(this.members.values());
  }

  broadcastToAllMembers(message: any): void {
    for (const member of this.members.values()) {
      member.sendControlMessage(message);
    }
  }

  broadcastPublicationReady(
    publicationId: string,
    publisherMemberId: string,
  ): void {
    const message = {
      type: "publicationReady",
      payload: {
        publicationId: publicationId,
        publisherMemberId: publisherMemberId,
      },
    };
    this.broadcastToAllMembers(message);
  }

  setupSubscriptionForwarding(
    publicationId: string,
    subscription: DataSubscription,
  ): void {
    // Find the publication across all members
    for (const member of this.members.values()) {
      const publication = member.getDataPublication(publicationId);
      if (publication) {
        // Set up forwarding from publication to subscription
        publication.onMessage.subscribe((data) => {
          subscription.forwardMessage(data);
        });

        console.log(
          `Set up forwarding from publication ${publicationId} to subscription ${subscription.subscriptionId}`,
        );
        return;
      }
    }

    console.warn(
      `Publication ${publicationId} not found for subscription forwarding`,
    );
  }

  cleanup(): void {
    for (const member of this.members.values()) {
      member.dispose();
    }
    this.members.clear();
  }

  dispose(): void {
    this.cleanup();
  }

  onMediaPublicationReady(
    publicationId: string,
    publisherMemberId: string,
  ): void {
    const message = {
      type: "mediaPublicationReady",
      payload: {
        publicationId: publicationId,
        publisherMemberId: publisherMemberId,
      },
    };
    this.broadcastToAllMembers(message);
    console.log(
      `Media publication ${publicationId} from member ${publisherMemberId} is ready`,
    );
  }

  findMediaPublication(publicationId: string): MediaPublication | null {
    // Search through all members for the MediaPublication with the given ID
    for (const member of this.members.values()) {
      const publication = member.getMediaPublication(publicationId);
      if (publication) {
        return publication;
      }
    }
    return null;
  }

  getExistingPublications(): {
    dataPublications: Array<{
      publicationId: string;
      publisherMemberId: string;
    }>;
    mediaPublications: Array<{
      publicationId: string;
      publisherMemberId: string;
    }>;
  } {
    const dataPublications: Array<{
      publicationId: string;
      publisherMemberId: string;
    }> = [];
    const mediaPublications: Array<{
      publicationId: string;
      publisherMemberId: string;
    }> = [];

    for (const member of this.members.values()) {
      // Collect data publications
      for (const publication of member.getDataPublications()) {
        dataPublications.push({
          publicationId: publication.publicationId,
          publisherMemberId: member.memberId,
        });
      }

      // Collect all media publications (including pending ones)
      for (const publication of member.getAllMediaPublications()) {
        mediaPublications.push({
          publicationId: publication.publicationId,
          publisherMemberId: member.memberId,
        });
      }
    }

    return { dataPublications, mediaPublications };
  }

  private sendExistingPublications(member: Member): void {
    const existingPublications = this.getExistingPublications();

    console.log(
      `[Room] Sending existing publications to member ${member.memberId}: ${existingPublications.dataPublications.length} data, ${existingPublications.mediaPublications.length} media`,
    );

    // Send existing data publications
    for (const publication of existingPublications.dataPublications) {
      member
        .sendControlMessage({
          type: "publicationReady",
          payload: {
            publicationId: publication.publicationId,
            publisherMemberId: publication.publisherMemberId,
          },
        })
        .catch(console.error);
    }

    // Send existing media publications
    for (const publication of existingPublications.mediaPublications) {
      member
        .sendControlMessage({
          type: "mediaPublicationReady",
          payload: {
            publicationId: publication.publicationId,
            publisherMemberId: publication.publisherMemberId,
          },
        })
        .catch(console.error);
    }
  }

  async setupMediaSubscriptionForwarding(
    publicationId: string,
    subscriptionId: string,
    subscription: MediaSubscription,
  ): Promise<void> {
    try {
      // Find the publication across all members
      const publication = this.findMediaPublication(publicationId);
      if (!publication || !publication.track) {
        console.error(
          `Cannot subscribe to media publication ${publicationId}: not found or no track`,
        );

        // Find the subscriber member to send error message
        const subscriber = this.members.get(subscription.subscriberMemberId);
        if (subscriber) {
          await subscriber.sendControlMessage({
            type: "subscribeError",
            payload: {
              subscriptionId: subscriptionId,
              error: "Publication not found or no track available",
            },
          });
        }
        return;
      }

      // Find the subscriber member to set up transceiver
      const subscriber = this.members.get(subscription.subscriberMemberId);
      if (!subscriber) {
        console.error(
          `Subscriber member ${subscription.subscriberMemberId} not found`,
        );
        return;
      }

      const stream = new MediaStream({ id: `sub_${subscriptionId}` });
      stream.addTrack(publication.track);

      const transceiver = subscriber.peerConnection.addTransceiver(
        publication.track,
        {
          direction: "sendonly",
          streams: [stream],
        },
      );
      subscription.setTransceiver(transceiver);

      const offer = await subscriber.createOffer();

      await subscriber.sendControlMessage({
        type: "subscribeOffer",
        payload: {
          subscriptionId: subscriptionId,
          publicationId: publicationId,
          offer: offer,
        },
      });

      console.log(
        `Set up media forwarding from publication ${publicationId} to subscription ${subscriptionId}`,
      );
    } catch (error) {
      console.error(
        `Failed to set up media subscription forwarding for ${publicationId}:`,
        error,
      );

      // Find the subscriber member to send error message
      const subscriber = this.members.get(subscription.subscriberMemberId);
      if (subscriber) {
        await subscriber.sendControlMessage({
          type: "subscribeError",
          payload: {
            subscriptionId: subscriptionId,
            error: (error as Error).message,
          },
        });
      }
    }
  }
}
