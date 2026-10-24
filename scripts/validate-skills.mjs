#!/usr/bin/env node
// Validate every DSH skill bundle in this repository.
//
// The FAIL set mirrors what @deepseek-ai/dsh-skill-filesystem actually
// rejects (0.2.1-rc.2): a red run means DSH would silently DROP the skill.
//   - the bundle is <root>/<name>/SKILL.md with a kebab-case directory name
//   - YAML frontmatter has name + description, name matches the DSH rule
//   - invocation booleans, when present, are real booleans
//   - legacy camelCase invocation keys, which DSH rejects outright
//   - every relative Markdown link inside the skill resolves on disk
//
// WARN items are repository style rules, not DSH rules: an over-long
// description is TRUNCATED by DSH (497 chars + "..."), never dropped, and
// DSH does not require the frontmatter name to equal the directory name.
//
// Usage: node scripts/validate-skills.mjs [repoRoot]

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const BOOLEAN_FIELDS = ['disable-model-invocation', 'user-invocable']
const LEGACY_FIELDS = {
  disableModelInvocation: 'disable-model-invocation',
  modelInvocable: 'disable-model-invocation',
  userInvocable: 'user-invocable',
}
const TRUE = new Set(['true', 'yes', 'on', '1'])
const FALSE = new Set(['false', 'no', 'off', '0'])
const CATALOG_DESCRIPTION_MAX_LENGTH = 500

const repoRoot = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..'))
const failures = []
const warnings = []

/** Strip one layer of matching YAML quotes, as the real parser does. */
function unquote(value) {
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    return value.slice(1, -1)
  }
  return value
}

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
    data[unquote(line.slice(0, at).trim())] = unquote(line.slice(at + 1).trim())
  }
  return data
}

/** Every Markdown file shipped inside a skill directory, at any depth. */
function walkMarkdown(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) out.push(...walkMarkdown(path))
    else if (name.endsWith('.md')) out.push(path)
  }
  return out
}

function checkRelativeLinks(markdownPath, text) {
  const dir = dirname(markdownPath)
  for (const match of text.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) {
    const target = unquote(match[1])
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
    else if (front.name !== name) warnings.push(`${name}/SKILL.md: frontmatter name "${front.name}" differs from directory (DSH allows this; repository style keeps them equal)`)
    if (!front.description) failures.push(`${name}/SKILL.md: frontmatter requires description`)
    else {
      const normalized = front.description.replace(/\s+/g, ' ').trim()
      if (normalized.length > CATALOG_DESCRIPTION_MAX_LENGTH) {
        warnings.push(`${name}/SKILL.md: description is ${normalized.length} chars; DSH truncates the model catalog entry at ${CATALOG_DESCRIPTION_MAX_LENGTH}, so the tail is invisible to the model`)
      }
    }
    for (const [legacy, canonical] of Object.entries(LEGACY_FIELDS)) {
      if (front[legacy] !== undefined) failures.push(`${name}/SKILL.md: legacy field "${legacy}" is rejected by DSH; use "${canonical}"`)
    }
    for (const field of BOOLEAN_FIELDS) {
      const value = front[field]
      if (value === undefined) continue
      const normalized = value.toLowerCase()
      if (!TRUE.has(normalized) && !FALSE.has(normalized)) failures.push(`${name}/SKILL.md: field "${field}" must be a boolean, got "${value}"`)
    }
  }

  checkRelativeLinks(skillFile, text)
  for (const file of walkMarkdown(dir)) checkRelativeLinks(file, readFileSync(file, 'utf8'))
}

if (found === 0) failures.push('no <name>/SKILL.md bundle found at the repository root')
for (const warning of warnings) console.warn('WARN ' + warning)
if (failures.length > 0) {
  for (const failure of failures) console.error('FAIL ' + failure)
  console.error(`\n${failures.length} problem(s) across ${found} skill(s).`)
  process.exit(1)
}
console.log(`OK ${found} skill(s) valid${warnings.length > 0 ? `, ${warnings.length} warning(s)` : ''}.`)
