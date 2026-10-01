import { readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const backgroundDirectory = path.join(projectRoot, 'public', 'images', 'backgrounds')
const files = await readdir(backgroundDirectory, { withFileTypes: true })
const backgrounds = files
  .filter((file) => file.isFile() && /\.(jpe?g|png|webp)$/i.test(file.name))
  .map((file) => `/images/backgrounds/${encodeURIComponent(file.name)}`)
  .sort((a, b) => a.localeCompare(b))

await writeFile(path.join(backgroundDirectory, 'index.json'), `${JSON.stringify(backgrounds, null, 2)}\n`)
