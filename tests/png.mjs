/** Minimal dependency-free PNG reader for tests (8-bit, non-interlaced,
 * palette/gray/RGB/RGBA). Lets the suite compare model geometry with the actual
 * original pixels, e.g. that the sight-cone detection shape equals the drawn
 * cone_de_visao.png, without shipping a decoder in the game itself. */
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

export function readPng(file) {
  const buffer = readFileSync(file);
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error("Not a PNG");
  let offset = 8,
    width = 0,
    height = 0,
    depth = 0,
    type = 0,
    interlace = 0,
    palette = null,
    transparency = null;
  const data = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset),
      kind = buffer.toString("ascii", offset + 4, offset + 8),
      chunk = buffer.subarray(offset + 8, offset + 8 + length);
    if (kind === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      depth = chunk[8];
      type = chunk[9];
      interlace = chunk[12];
    } else if (kind === "PLTE") palette = chunk;
    else if (kind === "tRNS") transparency = chunk;
    else if (kind === "IDAT") data.push(chunk);
    else if (kind === "IEND") break;
    offset += 12 + length;
  }
  if (depth !== 8 || interlace) throw new Error("Unsupported PNG layout");
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type],
    stride = width * channels,
    raw = inflateSync(Buffer.concat(data)),
    pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)],
      row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)),
      out = pixels.subarray(y * stride, (y + 1) * stride),
      prev = y ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? out[i - channels] : 0,
        b = prev ? prev[i] : 0,
        c = prev && i >= channels ? prev[i - channels] : 0;
      let value = row[i];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c,
          pa = Math.abs(p - a),
          pb = Math.abs(p - b),
          pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[i] = value & 255;
    }
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const s = i * channels;
    let r, g, b, alpha;
    if (type === 6) [r, g, b, alpha] = pixels.subarray(s, s + 4);
    else if (type === 2) {
      [r, g, b] = pixels.subarray(s, s + 3);
      alpha = 255;
    } else if (type === 0) r = g = b = pixels[s];
    else if (type === 4) {
      r = g = b = pixels[s];
      alpha = pixels[s + 1];
    } else {
      const index = pixels[s];
      [r, g, b] = palette.subarray(index * 3, index * 3 + 3);
      alpha = transparency && index < transparency.length ? transparency[index] : 255;
    }
    rgba.set([r, g, b, alpha ?? 255], i * 4);
  }
  return { width, height, rgba, alpha: (x, y) => rgba[(y * width + x) * 4 + 3] };
}
