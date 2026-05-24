// 몬스터 이름 ↔ 이미지 파일 매핑 검증
//   1) chapters.ts 의 모든 몬스터 이름이 MONSTER_FILE_MAP 에 등록됐는지
//   2) 매핑된 파일이 실제로 public/images/MONSTER/ 에 존재하는지
//   3) (default 몬스터.webp 가 아닌) 정확한 이미지에 매핑되는지
//
// images.ts 는 import.meta.env.BASE_URL 을 직접 참조해 tsx 환경에서 import 불가 →
// 정규식으로 소스를 파싱해 MONSTER_FILE_MAP 만 추출하는 우회.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CHAPTER_THEMES } from '@/data/chapters'

const ROOT = process.cwd()
const IMG_ROOT = join(ROOT, 'public/images/MONSTER')
const IMAGES_TS = readFileSync(join(ROOT, 'src/ui/images.ts'), 'utf-8')

// MONSTER_FILE_MAP 블록 추출
function parseMonsterFileMap(): Record<string, string> {
  const startIdx = IMAGES_TS.indexOf('const MONSTER_FILE_MAP')
  if (startIdx < 0) throw new Error('MONSTER_FILE_MAP not found in images.ts')
  const block = IMAGES_TS.slice(startIdx)
  const endIdx = block.indexOf('\n}')
  if (endIdx < 0) throw new Error('MONSTER_FILE_MAP closing brace not found')
  const body = block.slice(0, endIdx)
  const map: Record<string, string> = {}
  const lineRe = /'([^']+)':\s*'([^']+)'/g
  let m: RegExpExecArray | null
  while ((m = lineRe.exec(body))) {
    map[m[1]] = m[2]
  }
  return map
}

const MONSTER_FILE_MAP = parseMonsterFileMap()

function monsterImageFilename(name: string): string {
  if (name.startsWith('미믹')) return '미믹.webp'
  if (MONSTER_FILE_MAP[name]) return `${MONSTER_FILE_MAP[name]}.webp`
  for (const [key, file] of Object.entries(MONSTER_FILE_MAP)) {
    if (name.includes(key)) return `${file}.webp`
  }
  return '몬스터.webp'
}

let pass = 0
let fail = 0
const issues: string[] = []

function check(label: string, cond: boolean, msg: string = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; issues.push(`${label}: ${msg}`); console.log(`  ✗ ${label}: ${msg}`) }
}

console.log(`MONSTER_FILE_MAP 항목 수: ${Object.keys(MONSTER_FILE_MAP).length}`)

console.log('\n========== 1. CHAPTER_THEMES 의 모든 몬스터 이름 ↔ 이미지 매칭 ==========')

const allNames: string[] = []
for (const [theme, def] of Object.entries(CHAPTER_THEMES)) {
  console.log(`\n[${theme}]`)
  const all = [...def.normalMonsters.map(m => m.name), def.boss.name, def.hardBoss?.name].filter(Boolean) as string[]
  for (const name of all) {
    allNames.push(name)
    const filename = monsterImageFilename(name)
    const filePath = join(IMG_ROOT, filename)
    const exists = existsSync(filePath)
    const isDefault = filename === '몬스터.webp'
    check(`  ${name} → ${filename}`, exists && !isDefault, !exists ? '파일 없음' : '기본값 폴백 — 매핑 누락')
  }
}

console.log('\n========== 2. PVP 적 매핑 ==========')
for (const name of ['악당 모험가', '격노한 수집가']) {
  const filename = monsterImageFilename(name)
  const exists = existsSync(join(IMG_ROOT, filename))
  check(`  ${name} → ${filename}`, exists && filename !== '몬스터.webp', '매핑 누락')
}

console.log('\n========== 3. 미믹 매핑 ==========')
for (const name of ['미믹 (고블린 족장 모방)', '미믹 (고블린 전사 모방)', '미믹']) {
  const filename = monsterImageFilename(name)
  check(`  ${name} → ${filename}`, filename === '미믹.webp', '미믹.webp 로 매핑되지 않음')
}

console.log('\n========== 4. MONSTER_FILE_MAP 키와 chapters.ts 이름 정합성 ==========')
//   - map 의 키가 chapters.ts 에 없으면 dead code (경고)
//   - chapters.ts 의 이름이 map 에 없으면 fallback 됨 (위 1 에서 잡힘)
const namesSet = new Set(allNames)
namesSet.add('악당 모험가')
namesSet.add('격노한 수집가')
let orphans = 0
for (const key of Object.keys(MONSTER_FILE_MAP)) {
  if (!namesSet.has(key)) {
    orphans++
    console.log(`  ⚠ ${key}: chapters.ts 에 없는 키 (dead mapping)`)
  }
}
if (orphans === 0) console.log('  ✓ 모든 매핑 키가 실제로 사용됨 (orphan 0)')
pass += orphans === 0 ? 1 : 0
fail += orphans > 0 ? 1 : 0

console.log('\n========== 결과 ==========')
console.log(`Pass: ${pass}`)
console.log(`Fail: ${fail}`)
if (fail > 0) {
  console.log('\n실패 항목:')
  for (const i of issues) console.log(`  - ${i}`)
  process.exit(1)
} else {
  console.log(`\n✅ 모든 ${allNames.length}개 몬스터 + PVP + 미믹 + orphan 검사 통과`)
}
