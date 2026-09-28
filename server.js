import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { timingSafeEqual } from "crypto";
import { WebSocketServer } from "ws";
import logger from "./logger.js";
import { vdtHandler } from "./image/api.js";

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
  const wss = new WebSocketServer({ server, handleProtocols: selectProtocol(terminalToken) });
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  app.use((req, res, next) => {
    logger.info(`[HTTP] ${req.method} ${req.path} - ${getClientIp(req)}`);
    next();
  });

  app.use((req, res, next) => {
    if (LOCAL_ONLY.test(req.path) && isTunnelRequest(req)) {
      logger.warn(`[HTTP] local-only path refused through the tunnel - ${req.method} ${req.path} - ${getClientIp(req)}`);
      return res.status(404).type("text").send("Not Found");
    }
    next();
  });

  app.post("/api/vdt", express.raw({ type: () => true, limit: "10mb" }), vdtHandler);
  if (photoStore) {
    app.get("/p/:name", async (req, res) => {
      try {
        const file = await photoStore.get(req.params.name);
        if (!file) throw new Error("unknown or expired");
        await new Promise((resolve, reject) => res.type("png").sendFile(file, (error) => (error ? reject(error) : resolve())));
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
    logger.warn(`[HTTP] 404 Not Found - ${req.method} ${req.path} - ${getClientIp(req)}`);
    res.status(404).send("Not Found");
  });

  wss.on("connection", (ws, req) => {
    const terminal = Boolean(terminalToken) && ws.protocol === terminalToken;
    logger.info(`[WS] New ${terminal ? "terminal" : "public"} client connected with IP ${getClientIp(req)} - Total clients: ${wss.clients.size}`);
    if (!terminal && req.headers["sec-websocket-protocol"]) {
      logger.warn(`[WS] Client ${getClientIp(req)} offered an unrecognised subprotocol`);
    }
    ws.on("close", () => {
      logger.info(`[WS] Client disconnected with IP ${getClientIp(req)} - Total clients: ${wss.clients.size}`);
    });
    ws.on("error", (error) => {
      logger.error(`[WS] Error: ${error.message}`);
    });

    Promise.resolve(serviceHandler(ws, req, { terminal })).catch((error) => {
      logger.error(`[WS] Page error: ${error.message}`);
      ws.terminate();
    });
  });

  const interval = setInterval(() => {
    logger.debug(`[WS] Sending ping to ${wss.clients.size} clients`);
    wss.clients.forEach((ws) => {
      ws.ping();
    });
  }, 60000);

  const sweeper = photoStore
    ? setInterval(() => {
        photoStore.sweep().catch((error) => logger.warn(`[Photobooth] sweep failed: ${error.message}`));
      }, sweepMs)
    : null;

  wss.on("close", () => {
    clearInterval(interval);
    if (sweeper) clearInterval(sweeper);
  });

  wss.on("error", (error) => {
    logger.error(`[WS] Error: ${error}`);
  });

  server.on("error", (error) => {
    logger.error(`[HTTP] Error: ${error}`);
  });

  server.listen(port, () => {
    const urls = startupUrls(port, publicUrl);
    logger.info(`WebSocket server started at: ${urls.websocket}`);
    logger.info(`Emulator server started at: ${urls.emulator}`);
  });

  return { server, wss };
}
