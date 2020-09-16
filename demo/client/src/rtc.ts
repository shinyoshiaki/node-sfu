import axios from "axios";

const http = axios.create({ baseURL: "http://127.0.0.1:12222" });

export class RTCManager {
  channel?: RTCDataChannel;

  join = () =>
    new Promise(async (r) => {
      const { peerId, offer } = (await http.get("/join")).data;
      console.log("offer", offer.sdp);

      const peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      peer.onicecandidate = ({ candidate }) => {
        if (candidate) {
          //   console.log("candidate", candidate);
          http.post("/candidate", { peerId, candidate });
        }
      };
      peer.oniceconnectionstatechange = () => {
        console.log("oniceconnectionstatechange", peer.iceConnectionState);
      };
      peer.ondatachannel = ({ channel }) => {
        this.channel = channel;
        console.log("connected");
        r();
      };

      await peer.setRemoteDescription(offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      await http.post("/answer", { peerId, answer: peer.localDescription });
    });
}
