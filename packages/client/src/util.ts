/* eslint-disable @typescript-eslint/ban-ts-comment */
export class PromiseQueue {
  queue: { promise: () => Promise<any>; call: () => void }[] = [];
  running = false;

  push = (promise: () => Promise<any>) =>
    new Promise<void>((r) => {
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
