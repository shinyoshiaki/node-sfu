import express, { type Request, type Response } from "express";
import {
  type Member,
  type Room,
  createRoom,
  findRoom,
} from "../../core/src/index.js";

const app = express();
app.use(express.json());
app.use((_, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  next();
});

// Store member references by connection ID
const membersByConnectionId = new Map<string, { room: Room; member: Member }>();

// Create a new room
app.post("/rooms", async (_req: Request, res: Response) => {
  try {
    const room = createRoom();
    res.json({ roomId: room.roomId });
    return;
  } catch (error: any) {
    res.status(500).json({ error: error.message });
    return;
  }
});

// Join a room (create member and get offer)
app.post("/rooms/:roomId/join", async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { name, metadata } = req.body;
    const room = findRoom(roomId);

    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    const { member, offerSdp } = await room.join({ name, metadata });

    // Store member reference for later use
    membersByConnectionId.set(member.memberId, { room, member });

    res.json({
      memberId: member.memberId,
      name: member.name,
      metadata: member.metadata,
      offer: offerSdp,
    });
    return;
  } catch (error: any) {
    res.status(500).json({ error: error.message });
    return;
  }
});

// Accept answer from client
app.post("/members/:memberId/answer", async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const { answer } = req.body;

    if (!answer) {
      res.status(400).json({ error: "Answer is required" });
      return;
    }

    const memberInfo = membersByConnectionId.get(memberId);
    if (!memberInfo) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    await memberInfo.member.accept(answer);
    res.json({ success: true });
    return;
  } catch (error: any) {
    res.status(500).json({ error: error.message });
    return;
  }
});

// Add ICE candidate from client
app.post(
  "/members/:memberId/ice-candidate",
  async (req: Request, res: Response) => {
    try {
      const { memberId } = req.params;
      const { candidate } = req.body;

      if (!candidate) {
        res.status(400).json({ error: "ICE candidate is required" });
        return;
      }

      const memberInfo = membersByConnectionId.get(memberId);
      if (!memberInfo) {
        res.status(404).json({ error: "Member not found" });
        return;
      }

      await memberInfo.member.addIceCandidate(candidate);
      res.json({ success: true });
      return;
    } catch (error: any) {
      res.status(500).json({ error: error.message });
      return;
    }
  },
);

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`Reference server listening on port ${PORT}`);
});
