import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const FILES = ['stockfish-18-lite-single.js', 'stockfish-18-lite-single.wasm']
const srcDir = resolve(root, 'node_modules/stockfish/bin')
const dstDir = resolve(root, 'public/stockfish')

if (!existsSync(dstDir)) mkdirSync(dstDir, { recursive: true })

for (const name of FILES) {
  const src = resolve(srcDir, name)
  const dst = resolve(dstDir, name)
  if (!existsSync(src)) {
    console.error(`[copy-stockfish] missing source: ${src}`)
    process.exit(1)
  }
  copyFileSync(src, dst)
  console.log(`[copy-stockfish] ${name}`)
}
