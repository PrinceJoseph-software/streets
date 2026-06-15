import { readFileSync } from 'fs'
import path from 'path'

/**
 * Load Anton + JetBrains Mono font data for Satori/ImageResponse.
 * Files live in public/fonts/ and are read once at module init (cached
 * between invocations on the same serverless instance).
 *
 * Used ONLY in Node.js runtime route handlers (/api/card/*).
 * Do NOT import in edge runtime or client components.
 */

function loadFont(filename: string): Buffer {
  return readFileSync(path.join(process.cwd(), 'public', 'fonts', filename))
}

export const antonFont = loadFont('Anton-Regular.ttf')
export const monoFont  = loadFont('JetBrainsMono-Regular.ttf')
