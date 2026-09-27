export const SIZE = 64;
const SIGMA = 1.9;
let cached = null;

// Void-and-cluster (Ulichney) with a fixed seed, so every run gets the same matrix.
function generate() {
  const n = SIZE * SIZE;
  const kernel = new Float32Array(n);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = Math.min(x, SIZE - x);
      const dy = Math.min(y, SIZE - y);
      kernel[y * SIZE + x] = Math.exp(-(dx * dx + dy * dy) / (2 * SIGMA * SIGMA));
    }
  }
  const energy = new Float32Array(n);
  const pattern = new Uint8Array(n);
  const toggle = (i, on) => {
    pattern[i] = on ? 1 : 0;
    const px = i % SIZE;
    const py = (i - px) / SIZE;
    for (let y = 0; y < SIZE; y++) {
      const ky = ((y - py + SIZE) % SIZE) * SIZE;
      for (let x = 0; x < SIZE; x++) {
        const k = kernel[ky + ((x - px + SIZE) % SIZE)];
        energy[y * SIZE + x] += on ? k : -k;
      }
    }
  };
  const extreme = (on) => {
    let best = -1;
    let value = on ? -Infinity : Infinity;
    for (let i = 0; i < n; i++) {
      if (pattern[i] !== (on ? 1 : 0)) continue;
      if (on ? energy[i] > value : energy[i] < value) {
        value = energy[i];
        best = i;
      }
    }
    return best;
  };
  let seed = 12345;
  const random = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const initial = Math.floor(n / 10);
  let count = 0;
  while (count < initial) {
    const i = Math.floor(random() * n);
    if (!pattern[i]) {
      toggle(i, true);
      count++;
    }
  }
  for (let iter = 0; iter < 2000; iter++) {
    const cluster = extreme(true);
    toggle(cluster, false);
    const voidSpot = extreme(false);
    toggle(voidSpot, true);
    if (voidSpot === cluster) break;
  }
  const rank = new Int32Array(n);
  const savedPattern = Uint8Array.from(pattern);
  const savedEnergy = Float32Array.from(energy);
  for (let r = initial - 1; r >= 0; r--) {
    const i = extreme(true);
    rank[i] = r;
    toggle(i, false);
  }
  pattern.set(savedPattern);
  energy.set(savedEnergy);
  for (let r = initial; r < n; r++) {
    const i = extreme(false);
    rank[i] = r;
    toggle(i, true);
  }
  const thresholds = new Float32Array(n);
  for (let i = 0; i < n; i++) thresholds[i] = (rank[i] + 0.5) / n;
  return thresholds;
}

export function blueNoise() {
  if (!cached) {
    const t = generate();
    cached = (x, y) => t[(y % SIZE) * SIZE + (x % SIZE)];
  }
  return cached;
}
