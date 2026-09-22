const fs = require('fs');
const path = require('path');

// Simple script to generate valid PNG icon files without external native dependencies
// Creates a minimal valid 1x1 or sized PNG with purple/cyan gradient bytes
function createMinimalPNG(size) {
  // We can write an SVG and also generate a standard clean PNG or use a pure JS PNG generator
  // Let's create an SVG first and a canvas-free binary PNG
  // A standard 1x1 transparent/colored PNG chunk or minimal valid PNG buffer:
  const width = size;
  const height = size;

  // Let's build an uncompressed PNG (IHDR, IDAT, IEND)
  const IHDR = Buffer.alloc(13);
  IHDR.writeUInt32BE(width, 0);
  IHDR.writeUInt32BE(height, 4);
  IHDR.writeUInt8(8, 8); // 8-bit depth
  IHDR.writeUInt8(6, 9); // RGBA
  IHDR.writeUInt8(0, 10); // Deflate
  IHDR.writeUInt8(0, 11); // Filter
  IHDR.writeUInt8(0, 12); // Interlace

  // Raw image bytes: each line starts with filter byte 0x00, followed by width*4 bytes
  const rawData = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData.writeUInt8(0, offset++); // filter type None
    for (let x = 0; x < width; x++) {
      // Create a nice cyan-to-indigo color (#00f0ff to #6366f1)
      const ratio = (x + y) / (width + height);
      const r = Math.round(0 * (1 - ratio) + 99 * ratio);
      const g = Math.round(240 * (1 - ratio) + 102 * ratio);
      const b = Math.round(255 * (1 - ratio) + 241 * ratio);
      rawData.writeUInt8(r, offset++);
      rawData.writeUInt8(g, offset++);
      rawData.writeUInt8(b, offset++);
      rawData.writeUInt8(255, offset++); // Alpha
    }
  }

  const zlib = require('zlib');
  const compressedData = zlib.deflateSync(rawData);

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(8 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    // CRC calculation
    const crc = crc32(Buffer.concat([Buffer.from(type, 'ascii'), data]));
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  // Precomputed CRC table
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    crcTable[n] = c;
  }
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = makeChunk('IHDR', IHDR);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

[16, 48, 128].forEach(size => {
  const png = createMinimalPNG(size);
  const filePath = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Generated icon-${size}.png (${png.length} bytes)`);
});
