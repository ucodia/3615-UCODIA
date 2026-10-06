import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { randomBytes, timingSafeEqual } from "crypto";
import { WebSocketServer } from "ws";
import logger, { withLogContext, errorFields } from "./logger.js";
import { vdtHandler } from "./image/api.js";
import { FILTER_CODES } from "./slice/photobooth-screens.js";

const MAX_PAYLOAD = 512 * 1024;
const PHOTO_NAME = new RegExp(`^([0-9a-f]{7})-(${Object.values(FILTER_CODES).join("|")})\\.png$`);

function getClientIp(req) {
  return (
    req.headers["cf-connecting-ip"] ||
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket.remoteAddress
  );
}

export function isTunnelRequest(req) {
  return Boolean(req.headers["cf-connecting-ip"]);
}

const LOCAL_ONLY = /^\/(playground\.html|lib\/|api\/vdt\/?$)/i;

export function startupUrls(port, publicUrl = null) {
  const emulator = publicUrl ? publicUrl.replace(/\/+$/, "") : `http://localhost:${port}`;
  return { emulator, websocket: emulator.replace(/^http/, "ws") };
}

export function selectProtocol(token) {
  if (!token) return () => false;
  const expected = Buffer.from(token);
  return (protocols) => {
    for (const offered of protocols) {
      const candidate = Buffer.from(offered);
      if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) return token;
    }
    return false;
  };
}

export function startServer(serviceHandler, port, { photoStore = null, sweepMs = 60000, terminalToken = null, publicUrl = null } = {}) {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, handleProtocols: selectProtocol(terminalToken), maxPayload: MAX_PAYLOAD });
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  app.use((req, res, next) => {
    if (LOCAL_ONLY.test(req.path) && isTunnelRequest(req)) {
      logger.warn("local_only_refused", { path: req.path.slice(0, 200), ip: getClientIp(req) });
      return res.status(404).type("text").send("Not Found");
    }
    next();
  });

  app.get("/", (req, res, next) => {
    if (req.method === "GET") logger.info("landing", { client: "emulator", via: isTunnelRequest(req) ? "tunnel" : "lan" });
    next();
  });

  app.post("/api/vdt", express.raw({ type: () => true, limit: "10mb" }), vdtHandler);
  if (photoStore) {
    app.get("/p/:name", async (req, res) => {
      const { name } = req.params;
      const file = await photoStore.get(name).catch(() => null);
      if (!file) {
        logger.info("download_missing", { name: name.slice(0, 200) });
        return res.status(404).type("text").send("Not found");
      }
      try {
        await new Promise((resolve, reject) => res.type("png").sendFile(file, (error) => (error ? reject(error) : resolve())));
        const [, hash, filter] = name.match(PHOTO_NAME) ?? [];
        logger.info("download", { hash, filter });
      } catch (error) {
        if (!res.headersSent) res.status(404).type("text").send("Not found");
      }
    });
  }

  app.use("/lib/image", express.static(path.join(__dirname, "image")));
  for (const file of ["screen.js", "mosaic.js"]) {
    app.get(`/lib/${file}`, (req, res) => res.sendFile(path.join(__dirname, file)));
  }

  app.use(express.static(path.join(__dirname, "emulator")));

  app.use((req, res) => {
    logger.debug("not_found", { path: req.path.slice(0, 200) });
    res.status(404).send("Not Found");
  });

  wss.on("connection", (ws, req) => {
    const terminal = Boolean(terminalToken) && ws.protocol === terminalToken;
    const sid = randomBytes(3).toString("hex");
    const client = terminal ? "minitel" : "emulator";
    const opened = Date.now();
    logger.info("connect", { sid, client });
    if (!terminal && req.headers["sec-websocket-protocol"]) {
      logger.warn("subprotocol_rejected", { ip: getClientIp(req) });
    }
    ws.on("close", () => {
      logger.info("disconnect", { sid, client, seconds: Math.round((Date.now() - opened) / 1000) });
    });
    ws.on("error", (error) => {
      logger.error("ws_error", { sid, client, ...errorFields(error) });
    });

    withLogContext({ sid, client }, async () => serviceHandler(ws, req, { terminal })).catch((error) => {
      logger.error("page_error", { sid, client, ...errorFields(error) });
      ws.terminate();
    });
  });

  const interval = setInterval(() => {
    logger.debug("ping", { clients: wss.clients.size });
    wss.clients.forEach((ws) => {
      ws.ping();
    });
  }, 60000);

  const sweeper = photoStore
    ? setInterval(() => {
        photoStore.sweep().catch((error) => logger.warn("store_sweep_failed", { error: error.message }));
      }, sweepMs)
    : null;

  wss.on("close", () => {
    clearInterval(interval);
    if (sweeper) clearInterval(sweeper);
  });

  wss.on("error", (error) => {
    logger.error("ws_error", errorFields(error));
  });

  server.on("error", (error) => {
    logger.error("server_error", errorFields(error));
  });

  server.listen(port);

  return { server, wss };
}
