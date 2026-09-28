import { sliceSchedule } from "./schedule.js";
import { omeletteFacts } from "./omelette.js";
import { venablesVibes } from "./venables.js";
import { createPhotobooth } from "./photobooth.js";
import { BrowserCamera } from "../photobooth/browser-camera.js";

const cameras = new WeakMap();
function browserCameraFor(ws) {
  let camera = cameras.get(ws);
  if (!camera) {
    camera = new BrowserCamera({ websocket: ws });
    cameras.set(ws, camera);
  }
  return camera;
}

export function buildPrograms({ camera, store, config, dump = null, makeBrowserCamera = browserCameraFor }) {
  const shared = { store, publicUrl: config.publicUrl, ttl: config.ttl };
  return [
    { key: "1", title: "exhibits calendar", handoff: (ws) => sliceSchedule(ws, "exhibits") },
    { key: "2", title: "workshops calendar", handoff: (ws) => sliceSchedule(ws, "workshops") },
    { key: "3", title: "omelette facts", handoff: omeletteFacts },
    { key: "V", title: "venables vibes", handoff: venablesVibes },
    { key: "P", title: "photobooth", terminal: true, handoff: createPhotobooth({ ...shared, camera, gamma: config.gamma, dump }) },
    { key: "P", title: "photobooth", terminal: false, handoff: (ws) => createPhotobooth({ ...shared, camera: makeBrowserCamera(ws) })(ws) },
  ];
}
