import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import StreamZip from 'node-stream-zip'
import * as tar from 'tar'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const dstDir = resolve(root, 'public/models')

const MODELS = [
  {
    name: 'vosk-model-small-en-us-0.15',
    url: 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip',
  },
  {
    name: 'vosk-model-small-fr-0.22',
    url: 'https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip',
  },
]

if (!existsSync(dstDir)) mkdirSync(dstDir, { recursive: true })

if (process.env.SKIP_VOSK_DOWNLOAD === '1') {
  console.log('[vosk] SKIP_VOSK_DOWNLOAD=1, skipping model fetch')
  process.exit(0)
}

for (const model of MODELS) {
  const targetFile = resolve(dstDir, `${model.name}.tar.gz`)
  if (existsSync(targetFile)) {
    console.log(`[vosk] ${model.name}.tar.gz already present, skipping`)
    continue
  }

  console.log(`[vosk] downloading ${model.url}`)
  const res = await fetch(model.url)
  if (!res.ok) {
    console.error(`[vosk] failed: HTTP ${res.status} ${res.statusText}`)
    process.exit(1)
  }
  const zipBuf = Buffer.from(await res.arrayBuffer())

  const workDir = mkdtempSync(join(tmpdir(), 'vosk-'))
  const zipPath = join(workDir, `${model.name}.zip`)
  writeFileSync(zipPath, zipBuf)

  console.log(`[vosk] extracting ${model.name}.zip`)
  const zip = new StreamZip.async({ file: zipPath })
  try {
    await zip.extract(null, workDir)
  } finally {
    await zip.close()
  }

  let folderName = model.name
  if (!existsSync(join(workDir, folderName))) {
    const candidates = readdirSync(workDir).filter((entry) => {
      const path = join(workDir, entry)
      return existsSync(join(path, 'am')) || existsSync(join(path, 'conf'))
    })
    if (candidates.length === 0) {
      console.error(`[vosk] no model folder found inside ${model.name}.zip`)
      process.exit(1)
    }
    folderName = candidates[0]
  }

  console.log(`[vosk] packing ${model.name}.tar.gz`)
  await tar.c({ gzip: true, file: targetFile, cwd: workDir }, [folderName])

  rmSync(workDir, { recursive: true, force: true })
  console.log(`[vosk] ${model.name}.tar.gz ready`)
}
