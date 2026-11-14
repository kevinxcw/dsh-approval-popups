import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'

// The Client half is plain JavaScript because the Module Loader evaluates it
// directly; `tsc` only builds the Host entry.
mkdirSync('lib', { recursive: true })
copyFileSync('src/client.js', 'lib/client.js')

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const bundle = readFileSync('lib/client.js', 'utf8')
const expected = `id: '${pkg.name}'`

if (!bundle.includes('__ModuleLoader__.load')) {
  throw new Error('lib/client.js does not register through __ModuleLoader__.load')
}
if (!bundle.includes(expected)) {
  throw new Error(`lib/client.js must declare ${expected}`)
}
