export const CAMERA_ON = 1;
export const CAPTURE = 2;
export const CAMERA_OFF = 3;

// The visitor's browser camera: control bytes go down, one raw RGB frame comes back.
export class BrowserCamera {
  #pending = null;

  constructor({ websocket, timeoutMs = 10000, width = 320, height = 240 }) {
    this.ws = websocket;
    this.timeoutMs = timeoutMs;
    this.width = width;
    this.height = height;
    websocket.on("message", (data, isBinary) => {
      if (isBinary && this.#pending) this.#pending(data);
    });
  }

  open() {
    this.#control(CAMERA_ON);
  }

  close() {
    this.#control(CAMERA_OFF);
  }

  #control(byte) {
    this.ws.send(Buffer.from([byte]));
  }

  capture() {
    if (this.#pending) return Promise.reject(new Error("capture in progress"));
    const expected = this.width * this.height * 3;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending = null;
        reject(new Error("camera timeout"));
      }, this.timeoutMs);
      this.#pending = (data) => {
        clearTimeout(timer);
        this.#pending = null;
        if (data.length === 0) reject(new Error("no camera"));
        else if (data.length !== expected) reject(new Error(`bad frame: ${data.length} bytes`));
        else resolve({ data: Buffer.from(data), raw: { width: this.width, height: this.height, channels: 3 } });
      };
      this.#control(CAPTURE);
    });
  }
}
