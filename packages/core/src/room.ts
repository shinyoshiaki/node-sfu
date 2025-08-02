import { v4 as uuidv4 } from "uuid";
import { MediaStream } from "../../../submodules/werift/packages/webrtc/src/index.js";
import type { RTCSessionDescriptionInit } from "../../../submodules/werift/packages/webrtc/src/index.js";
import type { DataPublication } from "./dataPublication.js";
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

  async join(options?: {
    name?: string;
    metadata?: Record<string, any>;
  }): Promise<{
    member: Member;
    offerSdp: RTCSessionDescriptionInit;
  }> {
    const member = new Member(options);
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
    member.onMediaUnpublished.subscribe((publicationId, publisherMemberId) => {
      this.onMediaUnpublished(publicationId, publisherMemberId);
    });
    member.onDataUnpublished.subscribe((publicationId, publisherMemberId) => {
      this.onDataUnpublished(publicationId, publisherMemberId);
    });

    member.onSubscriptionForwardingRequest.subscribe(
      (publicationId, subscription) => {
        this.setupSubscriptionForwarding(publicationId, subscription);
      },
    );

    member.onSubscriptionValidationRequest.subscribe(
      (publicationId, resolve) => {
        const exists = this.doesPublicationExist(publicationId);
        resolve(exists);
      },
    );

    member.onMediaSubscriptionValidationRequest.subscribe(
      (publicationId, resolve) => {
        const exists = this.doesMediaPublicationExist(publicationId);
        resolve(exists);
      },
    );

    member.onExistingPublicationsRequest.subscribe(() => {
      this.sendExistingPublications(member);
    });

    member.onExistingMembersRequest.subscribe(() => {
      this.sendExistingMembers(member);
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

    member.onControlChannelReady.subscribe(() => {
      this.broadcastMemberJoined(member);
    });

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

  private broadcastMemberJoined(joinedMember: Member): void {
    const message = {
      type: "memberJoined",
      payload: {
        memberId: joinedMember.memberId,
        name: joinedMember.name,
        metadata: joinedMember.metadata,
      },
    };

    // Broadcast to all members except the one that's joining
    for (const [currentMemberId, member] of this.members) {
      if (currentMemberId !== joinedMember.memberId) {
        member.sendControlMessage(message);
      }
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
    // Get the publication from the member to access metadata
    const member = this.members.get(publisherMemberId);
    const publication = member?.dataPublications.get(publicationId);

    const message = {
      type: "publicationReady",
      payload: {
        publicationId: publicationId,
        publisherMemberId: publisherMemberId,
        mediaType: "data" as const,
        metadata: publication?.metadata || {},
      },
    };
    this.broadcastToAllMembers(message);
  }

  doesPublicationExist(publicationId: string): boolean {
    // Check if the publication exists across all members
    for (const member of this.members.values()) {
      const publication = member.getDataPublication(publicationId);
      if (publication) {
        return true;
      }
    }
    return false;
  }

  doesMediaPublicationExist(publicationId: string): boolean {
    // Check if the media publication exists across all members (includes both pending and completed)
    for (const member of this.members.values()) {
      const publication = member.getMediaPublication(publicationId);
      if (publication) {
        return true;
      }

      // Also check pending media publications using getAllMediaPublications
      const allMediaPublications = member.getAllMediaPublications();
      if (
        allMediaPublications.some((pub) => pub.publicationId === publicationId)
      ) {
        return true;
      }
    }
    return false;
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
    // Find the media publication to get its type and metadata
    const publication = this.findMediaPublication(publicationId);
    const mediaType = publication?.mediaKind === "video" ? "video" : "audio";

    const message = {
      type: "mediaPublicationReady",
      payload: {
        publicationId: publicationId,
        publisherMemberId: publisherMemberId,
        mediaType: mediaType,
        metadata: publication?.metadata || {},
      },
    };
    this.broadcastToAllMembers(message);
    console.log(
      `Media publication ${publicationId} from member ${publisherMemberId} is ready`,
    );
  }

  onMediaUnpublished(publicationId: string, publisherMemberId: string): void {
    // Find the media publication to get its type before it's removed
    const publication = this.findMediaPublication(publicationId);
    const mediaType = publication?.mediaKind === "video" ? "video" : "audio";

    const message = {
      type: "mediaUnpublished",
      payload: {
        publicationId: publicationId,
        publisherMemberId: publisherMemberId,
        mediaType: mediaType,
      },
    };
    this.broadcastToAllMembers(message);
    console.log(
      `Media unpublished ${publicationId} (${mediaType}) from member ${publisherMemberId}`,
    );
  }

  onDataUnpublished(publicationId: string, publisherMemberId: string): void {
    const message = {
      type: "dataUnpublished",
      payload: {
        publicationId: publicationId,
        publisherMemberId: publisherMemberId,
      },
    };
    this.broadcastToAllMembers(message);
    console.log(
      `Data unpublished ${publicationId} from member ${publisherMemberId}`,
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

  getExistingPublications() {
    const dataPublications: DataPublication[] = [];
    const mediaPublications: MediaPublication[] = [];

    for (const member of this.members.values()) {
      // Collect data publications
      for (const publication of member.getDataPublications()) {
        dataPublications.push(publication);
      }

      // Collect all media publications (including pending ones)
      for (const publication of member.getAllMediaPublications()) {
        mediaPublications.push(publication);
      }
    }

    return { dataPublications, mediaPublications };
  }

  getExistingMembers(excludeMemberId?: string): Array<{
    memberId: string;
    name?: string;
    metadata?: Record<string, any>;
  }> {
    const existingMembers: Array<{
      memberId: string;
      name?: string;
      metadata?: Record<string, any>;
    }> = [];

    for (const member of this.members.values()) {
      // Exclude the requesting member
      if (member.memberId !== excludeMemberId) {
        existingMembers.push({
          memberId: member.memberId,
          name: member.name,
          metadata: member.metadata,
        });
      }
    }

    return existingMembers;
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
            publisherMemberId: publication.memberId,
            mediaType: "data" as const,
            metadata: publication.metadata || {},
          },
        })
        .catch(console.error);
    }

    // Send existing media publications
    for (const publication of existingPublications.mediaPublications) {
      const mediaPublication = this.findMediaPublication(
        publication.publicationId,
      );
      const mediaType =
        mediaPublication?.mediaKind === "video" ? "video" : "audio";

      member
        .sendControlMessage({
          type: "mediaPublicationReady",
          payload: {
            publicationId: publication.publicationId,
            publisherMemberId: publication.memberId,
            mediaType: mediaType,
            metadata: mediaPublication?.metadata || {},
          },
        })
        .catch(console.error);
    }
  }

  private sendExistingMembers(member: Member): void {
    const existingMembers = this.getExistingMembers(member.memberId);

    console.log(
      `[Room] Sending existing members to member ${member.memberId}: ${existingMembers.length} members`,
    );

    // Send existing member information
    for (const existingMember of existingMembers) {
      member
        .sendControlMessage({
          type: "memberJoined",
          payload: {
            memberId: existingMember.memberId,
            name: existingMember.name,
            metadata: existingMember.metadata,
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
