// bananaimages PNG → WebP 일괄 변환
// 원본은 _png_backup/ 으로 이동, .webp 파일만 남김
import { readdirSync, statSync, renameSync, mkdirSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import sharp from 'sharp'

const SRC = 'bananaimages'
const BACKUP = join(SRC, '_png_backup')
mkdirSync(BACKUP, { recursive: true })

const files = readdirSync(SRC).filter(f => f.endsWith('.png') && !f.startsWith('_'))
let totalIn = 0, totalOut = 0

for (const f of files) {
  const srcPath = join(SRC, f)
  const outPath = join(SRC, basename(f, '.png') + '.webp')
  const sizeIn = statSync(srcPath).size
  totalIn += sizeIn

  await sharp(srcPath).webp({ quality: 90 }).toFile(outPath)
  const sizeOut = statSync(outPath).size
  totalOut += sizeOut

  // 원본 PNG 백업 이동
  renameSync(srcPath, join(BACKUP, f))
  console.log(`  ${f}: ${(sizeIn/1024).toFixed(0)}KB → ${(sizeOut/1024).toFixed(0)}KB (${((1 - sizeOut/sizeIn) * 100).toFixed(0)}% ↓)`)
}

console.log(`\n총 ${files.length}장`)
console.log(`이전: ${(totalIn / 1024 / 1024).toFixed(1)}MB`)
console.log(`이후: ${(totalOut / 1024 / 1024).toFixed(1)}MB`)
console.log(`절감: ${((1 - totalOut/totalIn) * 100).toFixed(1)}%`)
