import express from "express";
import bodyParser from "body-parser";
import https from "https";
import * as fs from "fs";
import { start } from "./src/main";

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
start(app);
