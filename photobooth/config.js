import ffmpegStatic from "ffmpeg-static";

export function photoboothConfig(env = process.env, platform = process.platform) {
  const ttl = Number(env.PHOTOBOOTH_TTL);
  const gamma = Number(env.PHOTOBOOTH_GAMMA);
  return {
    device: env.PHOTOBOOTH_DEVICE || (platform === "darwin" ? "0" : "/dev/video0"),
    ffmpeg: env.PHOTOBOOTH_FFMPEG || ffmpegStatic,
    publicUrl: (env.PUBLIC_URL || "http://localhost:3615").replace(/\/+$/, ""),
    ttl: Number.isFinite(ttl) && ttl > 0 ? ttl : 300,
    gamma: Number.isFinite(gamma) && gamma > 0 ? gamma : 1,
    dump: env.PHOTOBOOTH_DUMP || null,
    controls: (env.PHOTOBOOTH_CONTROLS || "").split(",").map((c) => c.trim()).filter(Boolean),
  };
}
