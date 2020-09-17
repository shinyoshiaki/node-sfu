import express from "express";
import bodyParser from "body-parser";
import { Room } from "../../src";

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use((_, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  next();
});
app.listen(12222);

console.log("start");

const room = new Room();

app.get("/join", async (req, res) => {
  console.log("join");
  const [peerId, offer] = await room.join();
  return res.send({ peerId, offer });
});

app.post("/answer", async (req, res) => {
  const { peerId, answer } = req.body;
  room.handleAnswer(peerId, answer);
  return res.send({});
});

app.post("/candidate", async (req, res) => {
  const { peerId, candidate } = req.body;
  room.handleCandidate(peerId, candidate);
  return res.send({});
});
