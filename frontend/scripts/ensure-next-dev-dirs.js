const fs = require('node:fs')
const path = require('node:path')

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

// Next.js dev server expects this folder when writing manifests.
// Some environments (especially when switching between build/dev or using Turbopack)
// can hit ENOENT if it doesn't exist yet.
ensureDir(path.join(__dirname, '..', '.next', 'static', 'development'))

