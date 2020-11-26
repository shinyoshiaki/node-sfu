import { Input, InputArguments } from "./input";
import { Readable, ReadableOptions } from "stream";

import * as _ from "underscore";

export interface MixerArguments extends ReadableOptions {
  channels: number;
  sampleRate: number;
  sleep: number;
  bitDepth?: number;
}

export class Mixer extends Readable {
  protected inputs: Input[];
  protected sampleByteLength: number;
  protected readSample;
  protected writeSample;
  protected needReadable: boolean = true;

  private static INPUT_IDLE_TIMEOUT = 250;
  private _timer: any = null;

  constructor(protected args: MixerArguments) {
    super(args);

    if (args.sampleRate < 1) {
      args.sampleRate = 44100;
    }

    const buffer = Buffer.alloc(0);

    if (args.bitDepth === 8) {
      this.readSample = buffer.readInt8;
      this.writeSample = buffer.writeInt8;

      this.sampleByteLength = 1;
    } else if (args.bitDepth === 32) {
      this.readSample = buffer.readInt32LE;
      this.writeSample = buffer.writeInt32LE;

      this.sampleByteLength = 4;
    } else {
      args.bitDepth = 16;

      this.readSample = buffer.readInt16LE;
      this.writeSample = buffer.writeInt16LE;

      this.sampleByteLength = 2;
    }

    this.inputs = [];
  }

  /**
   * Called when this stream is read from
   */
  public _read() {
    let samples = this.getMaxSamples();

    if (samples > 0 && samples !== Number.MAX_VALUE) {
      let mixedBuffer = new Buffer(
        samples * this.sampleByteLength * this.args.channels
      );

      mixedBuffer.fill(0);

      this.inputs.forEach((input) => {
        if (input.hasData) {
          let inputBuffer =
            this.args.channels === 1
              ? input.readMono(samples)
              : input.readStereo(samples);

          for (let i = 0; i < samples * this.args.channels; i++) {
            let sample =
              this.readSample.call(mixedBuffer, i * this.sampleByteLength) +
              Math.floor(
                this.readSample.call(inputBuffer, i * this.sampleByteLength) /
                  this.inputs.length
              );
            this.writeSample.call(
              mixedBuffer,
              sample,
              i * this.sampleByteLength
            );
          }
        }
      });

      this.push(mixedBuffer);
    } else if (this.needReadable) {
      clearTimeout(this._timer);
      this._timer = setTimeout(this._read.bind(this), this.args.sleep);
    }

    this.clearBuffers();
  }

  /**
   * Adds an input to this mixer
   * @param args The input's arguments
   */
  public input(args: InputArguments, channel?: number) {
    let input = new Input({
      channels: args.channels || this.args.channels,
      bitDepth: args.bitDepth || this.args.bitDepth,
      sampleRate: args.sampleRate || this.args.sampleRate,
      volume: args.volume || 100,
      clearInterval: args.clearInterval,
      maxBuffer: args.maxBuffer,
    });

    this.addInput(input, channel);

    return input;
  }

  /**
   * Removes the specified input
   * @param input The input
   */
  public removeInput(input: Input) {
    this.inputs = _.without(this.inputs, input);
  }

  /**
   * Adds the specified input to this mixer
   * @param input The input
   */
  public addInput(input: Input, channel?: number) {
    if (channel && (channel < 0 || channel >= this.args.channels)) {
      throw new Error("Channel number out of range");
    }

    input.setMixer(this);

    this.inputs[channel || this.inputs.length] = input;
  }

  /**
   * Removes all of the inputs
   */
  public destroy() {
    this.inputs = [];
  }

  public close() {
    this.needReadable = false;
  }

  /**
   * Gets the max number of samples from all inputs
   */
  protected getMaxSamples() {
    let samples = Number.MAX_VALUE;

    this.inputs.forEach((input) => {
      let ias = input.availableSamples();

      if (ias > 0) {
        input.lastDataTime = new Date().getTime();
      } else if (
        ias <= 0 &&
        new Date().getTime() - input.lastDataTime >= Mixer.INPUT_IDLE_TIMEOUT
      ) {
        input.hasData = false;

        return;
      }

      if (input.hasData && ias < samples) {
        samples = ias;
      }
    });

    return samples;
  }

  /**
   * Clears all of the input's buffers
   */
  protected clearBuffers() {
    this.inputs.forEach((input) => {
      input.clear();
    });
  }
}
