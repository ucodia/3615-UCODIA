import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
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

export function startServer(serviceHandler, port) {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  app.use((req, res, next) => {
    logger.info(`[HTTP] ${req.method} ${req.path} - ${getClientIp(req)}`);
    next();
  });

  app.post("/api/vdt", express.raw({ type: () => true, limit: "10mb" }), vdtHandler);
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
    logger.info(`[WS] New client connected with IP ${getClientIp(req)} - Total clients: ${wss.clients.size}`);
    ws.on("close", () => {
      logger.info(`[WS] Client disconnected with IP ${getClientIp(req)} - Total clients: ${wss.clients.size}`);
    });
    ws.on("error", (error) => {
      logger.error(`[WS] Error: ${error.message}`);
    });

    serviceHandler(ws, req);
  });

  const interval = setInterval(() => {
    logger.debug(`[WS] Sending ping to ${wss.clients.size} clients`);
    wss.clients.forEach((ws) => {
      ws.ping();
    });
  }, 60000);

  wss.on("close", () => {
    clearInterval(interval);
  });

  wss.on("error", (error) => {
    logger.error(`[WS] Error: ${error}`);
  });

  server.on("error", (error) => {
    logger.error(`[HTTP] Error: ${error}`);
  });

  server.listen(port, () => {
    logger.info(`WebSocket server started at: ws://localhost:${port}`);
    logger.info(`Emulator server started at: http://localhost:${port}`);
  });

  return { server, wss };
}
