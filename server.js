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

  app.use(express.static(path.join(__dirname, "emulator")));
  wss.on("connection", serviceHandler);

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
    console.log(` • Emulator:   http://localhost:${port}?url=${localUrl}`);
  });

  return { server, wss };
}
