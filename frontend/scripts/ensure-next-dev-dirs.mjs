import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

// Next.js dev server expects this folder when writing manifests.
// Some environments (especially when switching between build/dev or using Turbopack)
// can hit ENOENT if it doesn't exist yet.
ensureDir(path.join(__dirname, '..', '.next', 'static', 'development'))
