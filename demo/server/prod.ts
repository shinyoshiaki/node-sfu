import express from "express";
import bodyParser from "body-parser";
import { Room } from "../../src";
import https from "https";
import * as fs from "fs";

const options = {
  key: fs.readFileSync("/etc/letsencrypt/live/node-sfu.tk/privkey.pem"),
  cert: fs.readFileSync("/etc/letsencrypt/live/node-sfu.tk/fullchain.pem"),
};

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

const server = https.createServer(options, app);
server.listen(443);

console.log("start");

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
