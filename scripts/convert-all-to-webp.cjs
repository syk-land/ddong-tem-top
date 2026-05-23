#!/usr/bin/env node
// public/images 하위의 모든 .png 를 .webp 로 변환하고 원본 PNG 삭제.
// USER/USER_BUST 는 split-moe-grid 가 이미 webp 로 생성하므로 중복 작업 없음 (스킵).

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', 'public', 'images');
const QUALITY = 88;
const KEEP_PNG_NAMES = new Set([]); // 만약 보존이 필요한 png 있으면 여기

async function walk(dir) {
  const ents = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const ent of ents) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      await walk(full);
    } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.png')) {
      if (KEEP_PNG_NAMES.has(ent.name)) {
        continue;
      }
      const webp = full.replace(/\.png$/i, '.webp');
      try {
        await sharp(full).webp({ quality: QUALITY }).toFile(webp);
        const pngStat = fs.statSync(full);
        const webpStat = fs.statSync(webp);
        const saved = ((1 - webpStat.size / pngStat.size) * 100).toFixed(1);
        console.log(`${path.relative(ROOT, full)} -> .webp  (${(pngStat.size/1024).toFixed(0)}KB → ${(webpStat.size/1024).toFixed(0)}KB, -${saved}%)`);
        await fs.promises.unlink(full);
      } catch (e) {
        console.error(`[FAIL] ${path.relative(ROOT, full)}: ${e.message}`);
      }
    }
  }
}

(async () => {
  console.log(`Converting all .png under ${ROOT} → .webp`);
  await walk(ROOT);
  console.log('Done.');
})();
