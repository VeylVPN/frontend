const COLS = 26;
const ROWS = 9;
const OFF = [232, 115, 74];
const ON = [84, 232, 112];

const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));

export function createWave() {
  const canvas = document.createElement("canvas");
  canvas.className = "wave";
  const ctx = canvas.getContext("2d");
  let target = 0;
  let k = 0;
  let t = 0;
  let last = performance.now();

  function size() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    return { w, h, dpr };
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    k += (target - k) * Math.min(1, dt * 3);
    const { w, h, dpr } = size();
    if (w) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const cell = w / COLS;
      const top = (h - cell * ROWS) / 2;
      const gap = Math.max(1.5, cell * 0.12);
      const [r, g, b] = mix(OFF, ON, k);
      for (let c = 0; c < COLS; c++) {
        const down = 1.5 + (c / COLS) * (ROWS - 4);
        const live = ROWS / 2 - 0.5 + Math.sin(c * 0.42 + t * 1.6) * 1.1;
        const centre = down + (live - down) * k;
        const thick = 2.2 + (Math.sin(c * 0.55 - t * 1.1) * 0.9 + 0.9) * k;
        for (let row = 0; row < ROWS; row++) {
          const d = Math.abs(row + 0.5 - centre) - thick / 2;
          if (d > 0.6) continue;
          const a = d <= 0 ? 1 : 1 - d / 0.6;
          const shade = d > -0.5 ? 0.55 : 1;
          ctx.fillStyle = `rgba(${r},${g},${b},${(a * shade).toFixed(3)})`;
          const x = c * cell + gap / 2;
          const y = top + row * cell + gap / 2;
          ctx.beginPath();
          ctx.roundRect(x, y, cell - gap, cell - gap, cell * 0.18);
          ctx.fill();
        }
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    el: canvas,
    set(on) {
      target = on ? 1 : 0;
    },
  };
}
