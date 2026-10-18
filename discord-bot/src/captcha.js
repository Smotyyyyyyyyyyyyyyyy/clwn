const zlib = require('zlib');

// Generates a captcha image (PNG) with a random 6-digit code. No external libraries needed.

// 5x7 pixel font for the digits 0-9
const FONT = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
};

const W = 300;
const H = 100;
const COLORS = [[255, 99, 99], [255, 200, 87], [120, 220, 130], [110, 190, 255], [220, 140, 255], [255, 140, 190]];

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---- tiny PNG encoder ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(rgb) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0; // no filter
    rgb.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- drawing ----
function makeCaptcha() {
  const code = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('');
  const px = Buffer.alloc(W * H * 3);

  const set = (x, y, c, a = 1) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    px[i] = px[i] * (1 - a) + c[0] * a;
    px[i + 1] = px[i + 1] * (1 - a) + c[1] * a;
    px[i + 2] = px[i + 2] * (1 - a) + c[2] * a;
  };

  // background: dark gradient with noise
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const base = 22 + (x / W) * 18 + rnd(0, 14);
      set(x, y, [base, base, base + 10]);
    }
  }
  for (let n = 0; n < 700; n++) set(rnd(0, W), rnd(0, H), pick(COLORS), 0.35);

  // digits: rotated, scaled, wavy
  const cell = W / code.length;
  const phase = rnd(0, 6.28);
  for (let d = 0; d < code.length; d++) {
    const glyph = FONT[code[d]];
    const s = rnd(5.0, 5.8);
    const angle = rnd(-0.3, 0.3);
    const cx = cell * d + cell / 2 + rnd(-3, 3);
    const cy = H / 2 + rnd(-8, 8);
    const color = pick(COLORS);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const reach = Math.ceil(s * 5);
    for (let y = Math.floor(cy - reach); y <= cy + reach; y++) {
      for (let x = Math.floor(cx - reach); x <= cx + reach; x++) {
        let hits = 0;
        for (let sy = 0; sy < 2; sy++) {
          for (let sx = 0; sx < 2; sx++) {
            const wave = Math.sin((x + sx * 0.5) * 0.09 + phase) * 2;
            const dx = x + sx * 0.5 - cx;
            const dy = y + sy * 0.5 - cy - wave;
            const gx = (dx * cos + dy * sin) / s + 2.5;
            const gy = (-dx * sin + dy * cos) / s + 3.5;
            if (gx >= 0 && gx < 5 && gy >= 0 && gy < 7 && glyph[Math.floor(gy)][Math.floor(gx)] === '1') hits++;
          }
        }
        if (hits) set(x, y, color, hits / 4);
      }
    }
  }

  // lines drawn over the digits
  for (let n = 0; n < 5; n++) {
    const c = pick(COLORS);
    const x1 = rnd(0, W / 3);
    const x2 = rnd((W * 2) / 3, W);
    const y1 = rnd(5, H - 5);
    const y2 = rnd(5, H - 5);
    for (let t = 0; t <= 1; t += 1 / 400) {
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t + Math.sin(t * 12 + n) * 4;
      set(x, y, c, 0.7);
      set(x, y + 1, c, 0.7);
    }
  }
  for (let n = 0; n < 200; n++) set(rnd(0, W), rnd(0, H), pick(COLORS), 0.7);

  return { code, png: encodePng(px) };
}

module.exports = { makeCaptcha };
