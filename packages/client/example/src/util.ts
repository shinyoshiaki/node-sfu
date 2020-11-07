/* eslint-disable @typescript-eslint/ban-ts-comment */
export class PromiseQueue {
  queue: { promise: () => Promise<any>; call: () => void }[] = [];
  running = false;

  push = (promise: () => Promise<any>) =>
    new Promise((r) => {
      this.queue.push({ promise, call: r });
      if (!this.running) this.run();
    });

  async run() {
    const task = this.queue.shift();
    if (task) {
      this.running = true;
      await task.promise();
      task.call();

      this.run();
    } else {
      this.running = false;
    }
  }
}

export const endpointURL = (() => {
  //@ts-ignore
  console.log(NODE_ENV);
  //@ts-ignore
  switch (NODE_ENV || "") {
    case "dev":
      return "http://localhost:12222";
    default:
      return "https://node-sfu.tk";
  }
})();
