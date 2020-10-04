import { Express } from "express";
import { Room } from "../../src";

export function start(app: Express) {
  const room = new Room();

  app.get("/join", async (req, res) => {
    console.log("join");
    const [peerId, offer] = await room.join();
    return res.send({ peerId, offer });
  });

  app.post("/answer", async (req, res) => {
    const { peerId, answer } = req.body;
    await room.handleAnswer(peerId, answer);
    return res.send({});
  });

  app.post("/candidate", async (req, res) => {
    const { peerId, candidate } = req.body;
    await room.handleCandidate(peerId, candidate);
    return res.send({});
  });
}
