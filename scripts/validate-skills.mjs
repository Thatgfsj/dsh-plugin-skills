#!/usr/bin/env node
// Validate every DSH skill bundle in this repository.
//
// Checks mirror what @deepseek-ai/dsh-skill-filesystem actually enforces
// (0.2.0-rc.2), so a red run here means DSH would silently drop the skill:
//   - the bundle is <root>/<name>/SKILL.md with a kebab-case directory name
//   - YAML frontmatter has name + description, name matches the DSH rule
//   - invocation booleans, when present, are real booleans
//   - every relative Markdown link inside the skill resolves on disk
//
// Usage: node scripts/validate-skills.mjs [repoRoot]

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const BOOLEAN_FIELDS = ['disable-model-invocation', 'user-invocable']
const TRUE = new Set(['true', 'yes', 'on', '1'])
const FALSE = new Set(['false', 'no', 'off', '0'])

const repoRoot = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..'))
const failures = []

/** Parse the leading YAML frontmatter block without a YAML dependency. */
function parseFrontmatter(text) {
  if (!text.startsWith('---')) return undefined
  const end = text.indexOf('\n---', 3)
  if (end < 0) return undefined
  const body = text.slice(4, end)
  const data = {}
  for (const line of body.split('\n')) {
    if (line.trim() === '' || line.startsWith('#')) continue
    const at = line.indexOf(':')
    if (at < 0 || /^\s/.test(line)) continue
    data[line.slice(0, at).trim()] = line.slice(at + 1).trim()
  }
  return data
}

function checkRelativeLinks(markdownPath, text) {
  const dir = dirname(markdownPath)
  for (const match of text.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) {
    const target = match[1]
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('/')) continue
    if (!existsSync(resolve(dir, target))) failures.push(`${markdownPath}: dead relative link -> ${target}`)
  }
}

const entries = readdirSync(repoRoot).filter((name) => !name.startsWith('.') && name !== 'scripts' && name !== 'node_modules')
let found = 0
for (const name of entries) {
  const dir = join(repoRoot, name)
  if (!statSync(dir).isDirectory()) continue
  const skillFile = join(dir, 'SKILL.md')
  if (!existsSync(skillFile)) continue
  found += 1
  if (!SKILL_NAME.test(name)) failures.push(`${name}/SKILL.md: directory name is not kebab-case`)

  const text = readFileSync(skillFile, 'utf8')
  const front = parseFrontmatter(text)
  if (!front) {
    failures.push(`${name}/SKILL.md: missing YAML frontmatter`)
  } else {
    if (!front.name) failures.push(`${name}/SKILL.md: frontmatter requires name`)
    else if (!SKILL_NAME.test(front.name)) failures.push(`${name}/SKILL.md: invalid skill name "${front.name}"`)
    else if (front.name !== name) failures.push(`${name}/SKILL.md: frontmatter name "${front.name}" differs from directory`)
    if (!front.description) failures.push(`${name}/SKILL.md: frontmatter requires description`)
    else if (front.description.length > 500) failures.push(`${name}/SKILL.md: description is ${front.description.length} chars, over the 500-char catalog cap`)
    for (const field of BOOLEAN_FIELDS) {
      const value = front[field]
      if (value === undefined) continue
      const normalized = value.toLowerCase()
      if (!TRUE.has(normalized) && !FALSE.has(normalized)) failures.push(`${name}/SKILL.md: field "${field}" must be a boolean, got "${value}"`)
    }
  }

  checkRelativeLinks(skillFile, text)
  for (const sub of ['references', 'scripts', 'assets']) {
    const dirPath = join(dir, sub)
    if (!existsSync(dirPath)) continue
    for (const file of readdirSync(dirPath)) {
      if (!file.endsWith('.md')) continue
      checkRelativeLinks(join(dirPath, file), readFileSync(join(dirPath, file), 'utf8'))
    }
  }
}

if (found === 0) failures.push('no <name>/SKILL.md bundle found at the repository root')
if (failures.length > 0) {
  for (const failure of failures) console.error('FAIL ' + failure)
  console.error(`\n${failures.length} problem(s) across ${found} skill(s).`)
  process.exit(1)
}
console.log(`OK ${found} skill(s) valid.`)
