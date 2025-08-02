import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { MediaStreamTrack } from "werift";
import {
  RtpHeader,
  RtpPacket,
} from "../../../submodules/werift/packages/webrtc/src/index.js";
import type { Member, Room } from "../../core/src/index.js";
import type { Client, MediaSubscription } from "../src/index.js";
import {
  type DualClientSetup,
  cleanupDualClient,
  createDualClientSetup,
  createVideoTrack,
} from "./test-utils.js";

describe("Multiple media publication and subscription", () => {
  let setup: DualClientSetup;
  let room: Room;
  let client: Client; // Publisher
  let client2: Client; // Subscriber
  let member: Member;
  let member2: Member;

  beforeEach(async () => {
    setup = await createDualClientSetup();
    room = setup.room;
    client = setup.client1.client;
    client2 = setup.client2.client;
    member = setup.client1.member;
    member2 = setup.client2.member;

    // Wait for both clients to be connected
    await client.onConnected.asPromise(10000);
    await client2.onConnected.asPromise(10000);
  });

  afterEach(async () => {
    cleanupDualClient(setup);
  });

  /**
   * RTPパケット受信を待機するヘルパー関数
   */
  async function waitForRTPPackets(
    subscription: MediaSubscription,
    timeout: number = 5000,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let rtpReceived = false;

      const timeoutId = setTimeout(() => {
        if (!rtpReceived) {
          reject(new Error(`RTP packet not received within ${timeout}ms`));
        }
      }, timeout);

      const track = subscription.track as any as MediaStreamTrack;
      if (!track) {
        reject(new Error("Subscription track is not defined"));
        return;
      }

      const { unSubscribe: unsubscribeRtp } = track.onReceiveRtp.subscribe(
        () => {
          if (!rtpReceived) {
            rtpReceived = true;
            clearTimeout(timeoutId);
            unsubscribeRtp();
            resolve();
          }
        },
      );
    });
  }

  it(
    "should publish multiple media with different metadata and receive RTP packets",
    { timeout: 30000 },
    async () => {
      // 1. Metadata定義
      const cameraMetadata = {
        source: "camera",
        deviceType: "webcam",
        resolution: "1080p",
      };

      const screenShareMetadata = {
        source: "screen",
        deviceType: "display",
        captureType: "screen",
      };

      // 2. VideoTrack作成
      const cameraTrack = createVideoTrack();
      const screenTrack = createVideoTrack();

      // 3. RemotePublication受信待機セットアップ（既存テストパターンを使用）
      const cameraPromise = client2.onMediaPublicationReady.asPromise(10000);

      // 4. Camera MediaPublication作成
      const cameraPub = await client.publishMedia(cameraTrack, cameraMetadata);
      expect(cameraPub).toBeDefined();
      expect(cameraPub.metadata).toEqual(cameraMetadata);

      // 5. Camera RemotePublication受信確認
      const [cameraRemotePublication] = await cameraPromise;
      expect(cameraRemotePublication).toBeDefined();
      expect(cameraRemotePublication.metadata).toEqual(cameraMetadata);
      expect(cameraRemotePublication.id).toBe(cameraPub.publicationId);

      // 6. Screen RemotePublication受信待機セットアップ
      const screenPromise = client2.onMediaPublicationReady.asPromise(10000);

      // 7. Screen MediaPublication作成
      const screenPub = await client.publishMedia(
        screenTrack,
        screenShareMetadata,
      );
      expect(screenPub).toBeDefined();
      expect(screenPub.metadata).toEqual(screenShareMetadata);

      // 8. Screen RemotePublication受信確認
      const [screenRemotePublication] = await screenPromise;
      expect(screenRemotePublication).toBeDefined();
      expect(screenRemotePublication.metadata).toEqual(screenShareMetadata);
      expect(screenRemotePublication.id).toBe(screenPub.publicationId);

      // 9. MediaSubscription作成
      const cameraSubscription = await client2.subscribeMedia(
        cameraPub.publicationId,
      );
      const screenSubscription = await client2.subscribeMedia(
        screenPub.publicationId,
      );

      // 10. 基本検証
      expect(cameraSubscription).toBeDefined();
      expect(screenSubscription).toBeDefined();
      expect(cameraSubscription.track).toBeDefined();
      expect(screenSubscription.track).toBeDefined();
      expect(cameraSubscription.transceiver).toBeDefined();
      expect(screenSubscription.transceiver).toBeDefined();
      expect(cameraSubscription.track!.kind).toBe("video");
      expect(screenSubscription.track!.kind).toBe("video");

      // 11. 実際のRTPパケット送信・受信検証
      // カメラトラック用ダミーRTPパケット作成
      const cameraRtpHeader = new RtpHeader();
      cameraRtpHeader.payloadType = 98; // VP8
      cameraRtpHeader.sequenceNumber = 1;
      cameraRtpHeader.timestamp = 1000;
      cameraRtpHeader.ssrc = 12345;
      const cameraRtpPacket = new RtpPacket(
        cameraRtpHeader,
        Buffer.from("camera-test-data"),
      );

      // スクリーントラック用ダミーRTPパケット作成
      const screenRtpHeader = new RtpHeader();
      screenRtpHeader.payloadType = 98; // VP8
      screenRtpHeader.sequenceNumber = 1;
      screenRtpHeader.timestamp = 2000;
      screenRtpHeader.ssrc = 67890;
      const screenRtpPacket = new RtpPacket(
        screenRtpHeader,
        Buffer.from("screen-test-data"),
      );

      // RTPパケット受信待機の設定
      const cameraRtpPromise = waitForRTPPackets(cameraSubscription);
      const screenRtpPromise = waitForRTPPackets(screenSubscription);

      // ダミーRTPパケットを送信
      const cameraTrackWerift = cameraTrack as any as MediaStreamTrack;
      const screenTrackWerift = screenTrack as any as MediaStreamTrack;

      // 少し待ってからパケット送信（接続が安定するまで）
      await new Promise((resolve) => setTimeout(resolve, 1000));

      cameraTrackWerift.writeRtp(cameraRtpPacket.serialize());
      screenTrackWerift.writeRtp(screenRtpPacket.serialize());

      // RTPパケット受信確認
      await Promise.all([cameraRtpPromise, screenRtpPromise]);
    },
  );
});
