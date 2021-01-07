export async function getAudioStream(ab: ArrayBuffer, gain: number) {
  const ctx = new AudioContext();

  const audioBuffer = await ctx.decodeAudioData(ab);
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.loop = true;
  source.start();
  const gainNode = ctx.createGain();
  source.connect(gainNode);
  gainNode.gain.value = gain;
  const destination = ctx.createMediaStreamDestination();
  gainNode.connect(destination);
  source.connect(destination);

  return destination.stream;
}
