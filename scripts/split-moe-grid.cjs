#!/usr/bin/env node
// 씹덕전신.png / 씹덕흉상.png 를 5x2 그리드 (10조각) 로 분할.
// 출력:
//   public/images/USER/01.png ~ 10.png   (전신, 기존 USER 폴더의 21개 키 대체)
//   public/images/USER_BUST/01.png ~ 10.png (흉상, 전투 화면용)
// 검은 테두리를 약간 트림(crop margin)해서 패널 안쪽만 남긴다.

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const COLS = 5;
const ROWS = 2;
const CROP_MARGIN = 40;  // 셀 추출 시 안쪽으로 — 검은 패널 테두리(15~25px) 와 AA 까지 충분히 통과
// 캐릭터 bbox 검출 알고리즘
//   한 행/열을 "캐릭터 컨텐츠"로 보려면:
//     ① 어둡지 않은 픽셀 비율 ≥ 30% (= 검은 테두리 행 거르기)
//     ② 흰색이 아닌 픽셀 비율 ≥ 5% (= 완전 흰 마진 거르기)
//   두 조건 모두 만족하는 가장 바깥 행/열을 bbox 로 잡는다.
const DARK_LUM = 60;     // 이하면 검은 테두리
const LIGHT_LUM = 240;   // 이상이면 흰 배경
const NON_BLACK_RATIO = 0.30;
const NON_WHITE_RATIO = 0.05;
const BBOX_PAD = 6; // bbox 주변 패딩 (px)

function findCharacterBbox(data, info) {
  const { width, height, channels } = info;
  const rowNB = new Int32Array(height); // non-black per row
  const rowNW = new Int32Array(height); // non-white per row
  const colNB = new Int32Array(width);
  const colNW = new Int32Array(width);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum > DARK_LUM) { rowNB[y]++; colNB[x]++; }
      if (lum < LIGHT_LUM) { rowNW[y]++; colNW[x]++; }
    }
  }
  const isRow = (y) => rowNB[y] >= width * NON_BLACK_RATIO && rowNW[y] >= width * NON_WHITE_RATIO;
  const isCol = (x) => colNB[x] >= height * NON_BLACK_RATIO && colNW[x] >= height * NON_WHITE_RATIO;
  let minX = -1, maxX = -1, minY = -1, maxY = -1;
  for (let y = 0; y < height; y++) if (isRow(y)) { minY = y; break; }
  for (let y = height - 1; y >= 0; y--) if (isRow(y)) { maxY = y; break; }
  for (let x = 0; x < width; x++) if (isCol(x)) { minX = x; break; }
  for (let x = width - 1; x >= 0; x--) if (isCol(x)) { maxX = x; break; }
  if (minX < 0 || minY < 0) return null;
  minX = Math.max(0, minX - BBOX_PAD);
  minY = Math.max(0, minY - BBOX_PAD);
  maxX = Math.min(width - 1, maxX + BBOX_PAD);
  maxY = Math.min(height - 1, maxY + BBOX_PAD);
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function split({ input, outDir, doTrim }) {
  fs.mkdirSync(outDir, { recursive: true });
  const meta = await sharp(input).metadata();
  const cellW = Math.floor(meta.width / COLS);
  const cellH = Math.floor(meta.height / ROWS);
  console.log(`[${input}] ${meta.width}x${meta.height} -> cell ${cellW}x${cellH} (trim=${doTrim})`);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c + 1; // 1..10
      const id = String(idx).padStart(2, '0');
      const x = c * cellW + CROP_MARGIN;
      const y = r * cellH + CROP_MARGIN;
      const w = cellW - CROP_MARGIN * 2;
      const h = cellH - CROP_MARGIN * 2;
      const outPath = path.join(outDir, `${id}.webp`);

      // 1단계: 셀 추출 (PNG buffer in memory)
      const cellBuf = await sharp(input)
        .extract({ left: x, top: y, width: w, height: h })
        .png()
        .toBuffer();

      let finalBuf = cellBuf;
      if (doTrim) {
        // 2단계: raw 픽셀 스캔으로 캐릭터 bbox 직접 검출 → 그 영역만 crop
        const raw = await sharp(cellBuf).raw().toBuffer({ resolveWithObject: true });
        const bbox = findCharacterBbox(raw.data, raw.info);
        if (bbox) {
          finalBuf = await sharp(cellBuf).extract(bbox).png().toBuffer();
        } else {
          console.warn(`  [warn] no character bbox for ${id} — keeping cell as-is`);
        }
      }
      // 3단계: WebP 로 저장 (품질 88 — 캐릭터 일러스트에 충분히 손실 적음)
      const webpBuf = await sharp(finalBuf).webp({ quality: 88 }).toBuffer();
      await fs.promises.writeFile(outPath, webpBuf);
      const out = await sharp(outPath).metadata();
      console.log(`  -> ${outPath} (${out.width}x${out.height})`);
    }
  }
}

(async () => {
  // 전신: 인물 주변 흰 여백 자동 크롭 → 던전 카드의 portrait 비율에 깔끔하게 fit.
  await split({ input: '씹덕전신.png', outDir: 'public/images/USER', doTrim: true });
  // 흉상: 이미 패널을 거의 꽉 채우므로 trim 생략 (배경이 일러스트라 trim 부작용 우려).
  await split({ input: '씹덕흉상.png', outDir: 'public/images/USER_BUST', doTrim: false });
})();
