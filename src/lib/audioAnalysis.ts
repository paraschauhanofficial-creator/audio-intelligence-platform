import { parseBlob } from "music-metadata-browser";

export async function getAudioMetadata(file: File) {
  const metadata = await parseBlob(file);

  return {
    duration: metadata.format.duration,
    sampleRate: metadata.format.sampleRate,
    bitrate: metadata.format.bitrate,
    codec: metadata.format.codec,
  };
}