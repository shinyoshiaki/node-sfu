import { Writable, WritableOptions } from "stream";
import { Mixer } from "./mixer";
import * as _ from "underscore";

export class Input extends Writable {
  private mixer: Mixer;

  private buffer: Buffer = Buffer.alloc(0);
  private sampleByteLength: number;

  private readSample;
  private writeSample;

  public hasData: boolean;

  public lastDataTime: number;
  public lastClearTime: number;

  constructor(private args: InputArguments) {
    super(args);

    if (args.channels !== 1 && args.channels !== 2) {
      args.channels = 2;
    }

    if (args.sampleRate < 1) {
      args.sampleRate = 44100;
    }

    if (args.volume < 0 || args.volume > 100) {
      args.volume = 100;
    }

    if (args.channels === 1) {
      this.readMono = this.read;
    }

    if (args.channels === 2) {
      this.readStereo = this.read;
    }

    if (args.bitDepth === 8) {
      this.readSample = this.buffer.readInt8;
      this.writeSample = this.buffer.writeInt8;

      this.sampleByteLength = 1;
    } else if (args.bitDepth === 32) {
      this.readSample = this.buffer.readInt32LE;
      this.writeSample = this.buffer.writeInt32LE;

      this.sampleByteLength = 4;
    } else {
      args.bitDepth = 16;

      this.readSample = this.buffer.readInt16LE;
      this.writeSample = this.buffer.writeInt16LE;

      this.sampleByteLength = 2;
    }
    this.hasData = false;

    this.lastClearTime = new Date().getTime();
  }

  public setMixer(mixer: Mixer) {
    this.mixer = mixer;
  }

  /**
   * Reads the specified number of samples into a buffer
   * @param samples The number of samples to read
   */
  public read(samples) {
    let bytes = samples * (this.args.bitDepth / 8) * this.args.channels;
    if (this.buffer.length < bytes) {
      bytes = this.buffer.length;
    }

    const sample = this.buffer.slice(0, bytes);
    this.buffer = this.buffer.slice(bytes);

    for (let i = 0; i < sample.length; i += 2) {
      sample.writeInt16LE(
        Math.floor((this.args.volume * sample.readInt16LE(i)) / 100),
        i
      );
    }

    return sample;
  }

  /**
   * Reads the specified number of samples into a mono buffer
   * This function will be overridden by this.read, if input already is mono.
   * @param samples The number of samples to read
   */
  public readMono(samples) {
    const stereoBuffer = this.read(samples);
    const monoBuffer = Buffer.alloc(stereoBuffer.length / 2);

    const availableSamples = this.availableSamples(stereoBuffer.length);

    for (let i = 0; i < availableSamples; i++) {
      const l = this.readSample.call(
        stereoBuffer,
        i * this.sampleByteLength * 2
      );
      const r = this.readSample.call(
        stereoBuffer,
        i * this.sampleByteLength * 2 + this.sampleByteLength
      );

      this.writeSample.call(
        monoBuffer,
        Math.floor((l + r) / 2),
        i * this.sampleByteLength
      );
    }

    return monoBuffer;
  }

  /**
   * Reads the specified number of samples into a stereo buffer
   * This function will be overridden by this.read, if input already is stereo.
   * @param samples The number of samples to read
   */
  public readStereo(samples) {
    const monoBuffer = this.read(samples);
    const stereoBuffer = Buffer.alloc(monoBuffer.length * 2);

    const availableSamples = this.availableSamples(monoBuffer.length);

    for (let i = 0; i < availableSamples; i++) {
      const m = this.readSample.call(monoBuffer, i * this.sampleByteLength);

      this.writeSample.call(stereoBuffer, m, i * this.sampleByteLength * 2);
      this.writeSample.call(
        stereoBuffer,
        m,
        i * this.sampleByteLength * 2 + this.sampleByteLength
      );
    }

    return stereoBuffer;
  }

  /**
   * Gets the number of available samples in the buffer
   * @param length The length to get the number of samples for
   */
  public availableSamples(length?: number) {
    length = length || this.buffer.length;

    return Math.floor(length / ((this.args.bitDepth / 8) * this.args.channels));
  }

  /**
   * The method that gets called when this stream is being written to
   */
  public _write(chunk, encoding, next) {
    if (!this.hasData) {
      this.hasData = true;
    }

    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (this.buffer.length > this.args.maxBuffer) {
      this.buffer = chunk;
    }
    next();
  }

  /**
   * Sets the volume of this input
   * @param volume The volume
   */
  public setVolume(volume: number) {
    this.args.volume = Math.max(Math.min(volume, 100), 0);
  }

  /**
   * Gets the current volume for this input
   */
  public getVolume() {
    return this.args.volume;
  }

  /**
   * Clears the buffer but keeps 1024 samples still in the buffer to avoid a possible empty buffer
   */
  public clear(force?: boolean) {
    const now = new Date().getTime();

    if (
      force ||
      (this.args.clearInterval &&
        now - this.lastClearTime >= this.args.clearInterval)
    ) {
      let length = 1024 * (this.args.bitDepth / 8) * this.args.channels;
      this.buffer = this.buffer.slice(0, length);

      this.lastClearTime = now;
    }
  }

  /**
   * Clears the buffer
   */
  public destroy() {
    this.buffer = Buffer.alloc(0);
  }
}

export interface InputArguments extends WritableOptions {
  channels?: number;
  bitDepth?: number;
  sampleRate?: number;
  volume?: number;
  clearInterval?: number;
  maxBuffer?: number;
}
