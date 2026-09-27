import ffmpegStatic from "ffmpeg-static";

export function photoboothConfig(env = process.env, platform = process.platform) {
  const ttl = Number(env.PHOTOBOOTH_TTL);
  return {
    device: env.PHOTOBOOTH_DEVICE || (platform === "darwin" ? "0" : "/dev/video0"),
    ffmpeg: env.PHOTOBOOTH_FFMPEG || ffmpegStatic,
    publicUrl: (env.PUBLIC_URL || "http://localhost:3615").replace(/\/+$/, ""),
    ttl: Number.isFinite(ttl) && ttl > 0 ? ttl : 300,
  };
}
