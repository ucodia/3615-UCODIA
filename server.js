import { WebSocketServer } from "ws";
import http from "http";
import os from "os";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

export function startServer(serviceHandler, port, serviceName) {
  const host = "0.0.0.0"; // make accessible to LAN devices

  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  app.use((req, res, next) => {
    console.log(
      `${new Date().toISOString()} - [HTTP] ${req.method} ${req.path} - ${
        req.ip || req.socket.remoteAddress
      }`
    );
    next();
  });

  app.use(express.static(path.join(__dirname, "emulator")));

  wss.on("connection", (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    const clientPort = req.socket.remotePort;

    console.log(
      `${new Date().toISOString()} - [WS] Connection - ${clientIp}:${clientPort} - Total clients: ${
        wss.clients.size
      }`
    );
    ws.on("close", () => {
      console.log(
        `${new Date().toISOString()} - [WS] Disconnection - ${clientIp}:${clientPort} - Total clients: ${
          wss.clients.size
        }`
      );
    });
    ws.on("error", (error) => {
      console.error(
        `${new Date().toISOString()} - [WS] Error: ${error.message}`
      );
    });

    serviceHandler(ws);
  });

  const interval = setInterval(() => {
    console.log(
      `${new Date().toISOString()} - [WS] Sending ping to ${
        wss.clients.size
      } clients`
    );
    wss.clients.forEach((ws) => {
      ws.ping();
    });
  }, 60000);

  wss.on("close", () => {
    clearInterval(interval);
  });

  wss.on("error", (error) => {
    console.error(`${new Date().toISOString()} - [WS] Error: ${error}`);
  });

  server.on("error", (error) => {
    console.error(`${new Date().toISOString()} [HTTP] Error: ${error}`);
  });

  server.listen(port, host, () => {
    const networkInterfaces = os.networkInterfaces();
    let localIp = "localhost";

    // Find the local IP address
    Object.keys(networkInterfaces).forEach((ifname) => {
      networkInterfaces[ifname].forEach((iface) => {
        if (iface.family === "IPv4" && !iface.internal) {
          localIp = iface.address;
        }
      });
    });

    const localUrl = `ws://localhost:${port}`;
    const lanUrl = `ws://${localIp}:${port}`;

    console.log(`${serviceName} WebSocket server started!`);
    console.log("Available at:");
    console.log(` • Local:      ${localUrl}`);
    console.log(` • Network:    ${lanUrl}`);
    console.log(` • Emulator:   http://localhost:${port}`);
  });

  return { server, wss };
}
