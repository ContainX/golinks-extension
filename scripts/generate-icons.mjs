#!/usr/bin/env node

// Draws the action icon at every size Chrome asks for and writes them as PNGs.
//
// The mark is the arrow from the popup's "open" affordance on an indigo tile:
// a horizontal shaft with a chevron head, which reads at 16px. Rendered here
// rather than checked in as art so the palette stays in one place.

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SIZES = [16, 32, 48, 128]
const INDIGO = [0x3b, 0x5b, 0xdb]
const WHITE = [0xff, 0xff, 0xff]
const SAMPLES = 4

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function insideRoundedSquare(x, y, size, radius) {
  const inset = size * 0.02
  const min = inset
  const max = size - inset
  const cx = Math.min(Math.max(x, min + radius), max - radius)
  const cy = Math.min(Math.max(y, min + radius), max - radius)
  return Math.hypot(x - cx, y - cy) <= radius
}

function insideArrow(x, y, size) {
  const stroke = size * 0.085
  const left = size * 0.28
  const right = size * 0.72
  const mid = size * 0.5
  const head = size * 0.16
  const shaft = distanceToSegment(x, y, left, mid, right, mid)
  const upper = distanceToSegment(x, y, right - head, mid - head, right, mid)
  const lower = distanceToSegment(x, y, right - head, mid + head, right, mid)
  return Math.min(shaft, upper, lower) <= stroke
}

function render(size) {
  const radius = size * 0.22
  const pixels = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let tile = 0
      let arrow = 0
      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const px = x + (sx + 0.5) / SAMPLES
          const py = y + (sy + 0.5) / SAMPLES
          if (insideRoundedSquare(px, py, size, radius)) tile += 1
          if (insideArrow(px, py, size)) arrow += 1
        }
      }
      const total = SAMPLES * SAMPLES
      const tileAlpha = tile / total
      const arrowAlpha = Math.min(arrow / total, tileAlpha)
      const offset = (y * size + x) * 4
      for (let channel = 0; channel < 3; channel += 1) {
        const base = INDIGO[channel]
        const over = WHITE[channel]
        pixels[offset + channel] = Math.round(base * (1 - arrowAlpha) + over * arrowAlpha)
      }
      pixels[offset + 3] = Math.round(tileAlpha * 255)
    }
  }
  return pixels
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of SIZES) {
  const path = join(root, 'src', 'icons', `icon-${size}.png`)
  writeFileSync(path, encodePng(size, render(size)))
  console.log(`wrote ${path}`)
}
