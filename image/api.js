import { convert } from "./index.js";
import logger from "../logger.js";

export async function vdtHandler(req, res) {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    res.status(400).type("text").send("Request body must be an image");
    return;
  }
  try {
    const { bytes } = await convert(req.body, req.query);
    res.set("Content-Type", "application/octet-stream");
    res.set("X-Vdt-Bytes", String(bytes.length));
    res.send(bytes);
  } catch (error) {
    logger.warn("vdt_rejected", { error: error.message });
    res.status(400).type("text").send(error.message);
  }
}
