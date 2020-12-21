import axios from "axios";

export class HttpConnection {
  private readonly http = axios.create({ baseURL: this.props.url });
  constructor(private props: { url: string }) {}

  async create() {
    const { roomName } = (await this.http.post("/create")).data;
    return roomName;
  }

  async join(roomName: string) {
    const { peerId, offer } = (await this.http.put("/join", { roomName })).data;
    return { peerId, offer };
  }

  async candidate(
    peerId: string,
    roomName: string,
    candidate: RTCIceCandidate
  ) {
    this.http.post("/candidate", {
      peerId,
      candidate,
      roomName,
    });
  }

  async answer(
    peerId: string,
    roomName: string,
    answer: RTCSessionDescription
  ) {
    await this.http.post("/answer", {
      peerId,
      answer: answer,
      roomName,
    });
  }
}
