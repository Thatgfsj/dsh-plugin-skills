#!/usr/bin/env node
// Generate the machine-derived map of an installed DSH runtime.
//
// Everything that can be read off the installed packages is generated here
// instead of typed by hand, so the notes in references/internals/ cannot rot
// silently when DSH moves. Human commentary lives in the hand-written files.
//
// Output: references/internals/generated/{README,services,events,packages,slots}.md
//
// Usage: node scripts/dsh-map.mjs [--dsh-root <path>] [--out <dir>] [--check]
//   --check  exit 1 when the committed tables differ from a fresh run

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const BT = String.fromCharCode(96)
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function arg(name, fallback) {
  const index = process.argv.indexOf(name)
  return index < 0 ? fallback : process.argv[index + 1]
}

function candidateRoots() {
  const roots = []
  if (process.env.DSH_INSTALL) roots.push(process.env.DSH_INSTALL)
  roots.push('/home/thatgfsj/.npm-global/lib/node_modules/@deepseek-ai/dsh')
  try {
    const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
    roots.push(join(globalRoot, '@deepseek-ai', 'dsh'))
  } catch {}
  return roots
}

function resolveDshRoot() {
  const explicit = arg('--dsh-root')
  if (explicit) return resolve(explicit)
  for (const root of candidateRoots()) {
    const manifest = join(root, 'package.json')
    if (!existsSync(manifest)) continue
    try {
      if (JSON.parse(readFileSync(manifest, 'utf8')).name === '@deepseek-ai/dsh') return root
    } catch {}
  }
  throw new Error('cannot locate an installed @deepseek-ai/dsh; pass --dsh-root')
}

function walk(dir, test) {
  if (!existsSync(dir)) return []
  const out = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) out.push(...walk(path, test))
    else if (test(path)) out.push(path)
  }
  return out
}

function cell(value) {
  return String(value === undefined || value === null ? '' : value)
    .split('|').join('\\|')
    .split('\n').join(' ')
    .trim()
}

function code(value) { return BT + value + BT }
function list(values) { return values.length === 0 ? '—' : values.map(code).join(', ') }
function table(headers, rows) {
  const out = [row(headers), row(headers.map(() => '---'))]
  for (const cells of rows) out.push(row(cells))
  return out.join('\n')
}
function row(cells) { return '| ' + cells.join(' | ') + ' |' }

const dshRoot = resolveDshRoot()
const packagesDir = join(dshRoot, 'node_modules', '@deepseek-ai')
const runtimeVersion = JSON.parse(readFileSync(join(dshRoot, 'package.json'), 'utf8')).version

const packages = readdirSync(packagesDir)
  .map((name) => join(packagesDir, name))
  .filter((dir) => existsSync(join(dir, 'package.json')))
  .map((dir) => {
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    const jsFiles = walk(join(dir, 'lib'), (path) => /\.(?:js|mjs)$/.test(path))
    const typeFiles = walk(join(dir, 'lib', 'types'), (path) => path.endsWith('.d.ts'))
    return { dir, manifest, jsFiles, typeFiles }
  })
  .sort((a, b) => a.manifest.name.localeCompare(b.manifest.name))

const serviceRows = new Map()
for (const pkg of packages) {
  for (const file of pkg.jsFiles) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(/super\(ctx,\s*["']([A-Za-z_$][\w$.-]*)["']/g)) {
      const line = text.slice(0, match.index).split('\n').length
      const entry = serviceRows.get(match[1])
      if (entry === undefined) serviceRows.set(match[1], { pkg: pkg.manifest.name, file: relative(dshRoot, file), line, also: new Set() })
      else if (entry.pkg !== pkg.manifest.name) entry.also.add(pkg.manifest.name)
    }
  }
}

const events = new Map()
function eventEntry(name) {
  const existing = events.get(name)
  if (existing !== undefined) return existing
  const created = { name, mode: undefined, declaredBy: new Set(), dispatchedBy: new Set() }
  events.set(name, created)
  return created
}
// Events are declared either as property signatures ('name': payload) or as call
// signatures ('name'(args): void), so match the quote pair and look at what follows.
const EVENT_NAME = /['"]([a-z][a-z0-9-]*\/[a-z0-9-]+)['"]\s*(?:\?\s*)?(?::|\()/g
for (const pkg of packages) {
  for (const file of pkg.typeFiles) {
    const text = readFileSync(file, 'utf8')
    // Only Cordis interface Events blocks count: session event maps use the same
    // domain/action shape for a different namespace.
    for (const block of text.matchAll(/interface Events\s*\{([\s\S]*?)\n\s*\}/g)) {
      const body = block[1]
      for (const match of body.matchAll(EVENT_NAME)) {
        const entry = eventEntry(match[1])
        entry.declaredBy.add(pkg.manifest.name)
        if (entry.mode !== undefined) continue
        const preceding = body.slice(Math.max(0, match.index - 400), match.index)
        const mode = preceding.match(/@mode\s+(emit|parallel|serial|bail|waterfall)\b/g)
        if (mode !== null) entry.mode = mode[mode.length - 1].replace(/@mode\s+/, '')
      }
    }
  }
}
for (const pkg of packages) {
  for (const file of pkg.jsFiles) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(/ctx\.(?:emit|bail|serial|waterfall|parallel)\(\s*["']([a-z][a-z0-9-]*\/[a-z0-9-]+)["']/g)) {
      eventEntry(match[1]).dispatchedBy.add(pkg.manifest.name)
    }
  }
}

const slots = new Map()
for (const pkg of packages) {
  for (const file of pkg.jsFiles) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(/slots\.inject\(\s*["']([\w.-]+)["']/g)) {
      const set = slots.get(match[1])
      if (set === undefined) slots.set(match[1], new Set([pkg.manifest.name]))
      else set.add(pkg.manifest.name)
    }
  }
}

function roles(manifest) {
  const out = []
  if (manifest.dsh && manifest.dsh.bundle && manifest.dsh.bundle.patch) out.push('bundle')
  if (manifest.dsh && manifest.dsh.profile && manifest.dsh.profile.bundles) out.push('profile')
  if (manifest.dsh && manifest.dsh.client && manifest.dsh.client.platform) out.push('client:' + manifest.dsh.client.platform)
  if (manifest.bin) out.push('cli')
  if (manifest.icon) out.push('icon')
  return out
}

const outDir = resolve(arg('--out', join(repoRoot, 'dsh-plugin-construction', 'references', 'internals', 'generated')))
const generatedAt = new Date().toISOString().slice(0, 10)
const header = [
  '<!-- Generated by scripts/dsh-map.mjs from dsh ' + runtimeVersion + '. Do not edit by hand. -->',
  '<!-- Regenerate: node scripts/dsh-map.mjs -->',
  '',
].join('\n')

const files = {}
files['services.md'] = header + [
  '# Services (' + code('ctx.<name>') + ') — dsh ' + runtimeVersion,
  '',
  serviceRows.size + ' context keys announced by Service subclasses. A service key is the handle a consumer reads through ' + code('ctx.<name>') + '; the owning package declares it, and a profile layer may swap the implementation.',
  '',
  table(['ctx.<name>', 'owning package', 'also implemented by', 'source'],
    [...serviceRows.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, entry]) =>
      [code(cell(name)), code(cell(entry.pkg)), list([...entry.also].sort()), code(cell(entry.file)) + ':' + entry.line])),
  '',
].join('\n')
files['events.md'] = header + [
  '# Events — dsh ' + runtimeVersion,
  '',
  events.size + ' names found in ' + code('interface Events') + ' contracts or dispatch call sites. ' + code('declared by') + ' is where the contract lives; ' + code('dispatched by') + ' is who fires it. Persisted session event types are a different namespace — see 09-reading-source.md.',
  '',
  table(['event', 'mode', 'declared by', 'dispatched by'],
    [...events.values()].sort((a, b) => a.name.localeCompare(b.name)).map((entry) =>
      [code(cell(entry.name)), entry.mode === undefined ? '—' : code(entry.mode), list([...entry.declaredBy].sort()), list([...entry.dispatchedBy].sort())])),
  '',
].join('\n')
files['slots.md'] = header + [
  '# Client slots — dsh ' + runtimeVersion,
  '',
  slots.size + ' slot ids referenced through ctx.slots.inject(ownerKey, ...). The list is version-specific: regenerate instead of copying names into code.',
  '',
  table(['slot', 'referenced by'],
    [...slots.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, pkgs]) =>
      [code(cell(name)), list([...pkgs].sort())])),
  '',
].join('\n')
files['packages.md'] = header + [
  '# Packages — dsh ' + runtimeVersion,
  '',
  packages.length + ' packages ship inside the runtime. ' + code('roles') + ' is read from the manifest: ' + code('bundle') + ' and ' + code('client') + ' decide how the package participates in a composition; everything else is a plain plugin or library.',
  '',
  table(['package', 'version', 'roles', 'description'],
    packages.map((pkg) => [
      code(cell(pkg.manifest.name)),
      cell(pkg.manifest.version),
      roles(pkg.manifest).join(', ') || '—',
      cell((pkg.manifest.description || '').slice(0, 96)),
    ])),
  '',
].join('\n')
files['README.md'] = header + [
  '# Generated map',
  '',
  'Machine-derived from the installed runtime. **Do not edit these files by hand**: edit',
  code('scripts/dsh-map.mjs') + ' or the hand-written notes in ' + code('references/internals/') + ' instead.',
  '',
  table(['runtime', runtimeVersion], [['dsh install', code(dshRoot)], ['generated', generatedAt], ['packages', String(packages.length)], ['services', String(serviceRows.size)], ['events', String(events.size)], ['client slots', String(slots.size)]]),
  '',
  table(['table', 'contents'], [
    ['[services.md](services.md)', 'every ' + code('ctx.<name>') + ' handle, its owning package and source line'],
    ['[events.md](events.md)', 'event contract names, declarers and dispatchers'],
    ['[slots.md](slots.md)', 'client slot ids and the packages that touch them'],
    ['[packages.md](packages.md)', 'every shipped package with its manifest roles'],
  ]),
  '',
  'Regenerate with ' + code('node scripts/dsh-map.mjs') + '; CI runs it with ' + code('--check') + ' and fails on drift.',
  '',
].join('\n')

mkdirSync(outDir, { recursive: true })
const check = process.argv.includes('--check')
const drift = []
for (const [name, text] of Object.entries(files)) {
  const path = join(outDir, name)
  const previous = existsSync(path) ? readFileSync(path, 'utf8') : undefined
  if (previous === text) continue
  if (check) drift.push(name)
  else writeFileSync(path, text)
}

if (check) {
  if (drift.length > 0) {
    console.error('generated map is stale: ' + drift.join(', '))
    console.error('run: node scripts/dsh-map.mjs')
    process.exit(1)
  }
  console.log('generated map is up to date')
} else {
  console.log('wrote ' + Object.keys(files).length + ' table(s) for dsh ' + runtimeVersion + ' to ' + relative(repoRoot, outDir) + '/')
  console.log('packages ' + packages.length + ' · services ' + serviceRows.size + ' · events ' + events.size + ' · slots ' + slots.size)
}
