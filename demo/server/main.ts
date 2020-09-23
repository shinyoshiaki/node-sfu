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
  await room.handleAnswer(peerId, answer);
  return res.send({});
});

app.post("/candidate", async (req, res) => {
  const { peerId, candidate } = req.body;
  await room.handleCandidate(peerId, candidate);
  return res.send({});
});

// startHeapDiff();
// function startHeapDiff() {
//   setInterval(function generateHeapDumpAndStats() {
//     try {
//       global.gc();
//     } catch (e) {
//       console.log("次のコマンドで実行して下さい: 'node --expose-gc leak.js");
//       process.exit();
//     }
//     const heapUsed = process.memoryUsage().heapUsed;
//     console.log(Math.floor(heapUsed / 1024) + " Kバイト使用中");
//   }, 2000);
// }
