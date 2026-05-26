# WebP 이미지 파이프라인

> 모든 일러스트 / UI 아이콘은 WebP. 일반 PNG 대비 **평균 -90% ~ -95% 용량**. 빌드 사이즈 직격 절감.

스크립트:
- `scripts/split-moe-grid.cjs` — 씹덕 캐릭터 그리드 → 10조각 WebP
- `scripts/convert-all-to-webp.cjs` — `public/images/` 하위 모든 PNG → WebP 일괄

---

## 변환 결과 (대표 항목)

| 항목 | PNG | WebP | 절감 |
|---|---:|---:|---|
| 메인 일러스트 (`main.png`) | 6.3 MB | 0.3 MB | **-95%** |
| 튜토리얼 컷 (각) | 5.5 MB | 0.4 MB | **-92%** |
| 스킬 아이콘 (19종 평균) | 100 KB | 10 KB | **-90%** |
| UI 등급/스탯/상태 (~30종) | 70 KB | 6 KB | **-91%** |
| 캐릭터 흉상 (10종 평균) | ~80 KB | ~30 KB | **-60%** |

총 합계: 수십 MB → 수 MB.

---

## 분할 파이프라인 (`split-moe-grid.cjs`)

`씹덕전신.png` (3264×1312) / `씹덕흉상.png` 를 5×2 그리드로 10조각씩 분할.

```
[원본 PNG]
   │
   ├─ 셀 추출 (CROP_MARGIN=40px 안쪽)
   │     → 검은 패널 테두리 + AA 안전하게 통과
   │
   ├─ (전신만) 캐릭터 bbox 검출
   │     row/col 단위 raw 픽셀 스캔
   │     - lum > 60 (non-black) 비율 ≥ 30%
   │     - lum < 240 (non-white) 비율 ≥ 5%
   │     이 두 조건을 모두 만족하는 가장 바깥 행/열 = bbox
   │     → 흰 마진 + 잔여 테두리 동시 제거
   │
   └─ WebP 출력 (quality 88)
```

흉상은 패널을 거의 꽉 채우므로 bbox 단계 스킵 (배경이 일러스트라 trim 부작용 위험).

전신 결과 크기:
- 폭: 259~442 px (캐릭터별 너비 다양)
- 높이: 550~576 px (수직 캐릭터 높이는 균일)

---

## 일괄 변환 파이프라인 (`convert-all-to-webp.cjs`)

`public/images/` 재귀 탐색 → 모든 `.png` → 같은 이름 `.webp` 생성 후 원본 PNG 삭제.

```
public/images/
├─ BACKGROUND/*.png  →  *.webp
├─ ITEM/*.png        →  *.webp
├─ MONSTER/*.png     →  *.webp
├─ NPC/*.png         →  *.webp
├─ REALBOSS/*.png    →  *.webp
├─ SKILL/*.png       →  *.webp
├─ TUTORIAL/*.png    →  *.webp
├─ UI/*.png          →  *.webp
├─ USER/*.webp                ← split-moe-grid 가 이미 webp 로 생성
├─ USER_BUST/*.webp           ← split-moe-grid 가 이미 webp 로 생성
├─ main.png          →  main.webp
├─ main-portrait.png →  main-portrait.webp
└─ user.png          →  user.webp
```

코드 측 URL 빌더 (`src/ui/images.ts`) 의 모든 경로는 `.webp` 확장자. PNG 원본 보존 필요 시 `KEEP_PNG_NAMES` set 에 추가.

---

## 코드 참조 위치

`.webp` 경로를 만드는 모든 URL 빌더:

```ts
// src/ui/images.ts
themeBgUrl(theme)       // /images/BACKGROUND/{theme}.webp
defaultBgUrl()          // /images/BACKGROUND/배경.webp
rankIconUrl(rank)       // /images/UI/{rank}등급.webp
statIconUrl(stat)       // /images/UI/{file}.webp
statusIconUrl(kind)     // /images/UI/{file}.webp
npcIconUrl(key)         // /images/NPC/{file}.webp
shopIconUrl()           // /images/NPC/상점.webp
mainImageUrl()          // /images/main.webp?v=3
mainImagePortraitUrl()  // /images/main-portrait.webp?v=2
realBossImageUrl(theme) // /images/REALBOSS/{theme}.webp
tutorialImageUrl(p)     // /images/TUTORIAL/{p}.webp?v=3
userAvatarUrl(key)      // /images/USER/{key}.webp
userBustUrl(key)        // /images/USER_BUST/{key}.webp
playerImageUrl(?)       // 위 + /images/user.webp 폴백
playerBustUrl(?)        // 위 + USER_BUST/01.webp 폴백
skillIconUrl(key)       // /images/SKILL/{name}.webp
itemImageUrl(k, base)   // /images/ITEM/{file}.webp
monsterImageUrl(name)   // /images/MONSTER/{file}.webp
```

직접 경로 사용도 모두 `.webp`:
- `CharacterCreation.vue` 챌린지 뱃지 `/images/UI/챌린지{n}.webp`
- `stores/game.ts` 진짜 보스 직전 모달 `/images/REALBOSS/진짜보스직전.webp`

---

## 브라우저 호환성

- Chrome / Edge / Firefox / Safari (14+) : 모두 지원
- 모바일 Chrome / Samsung Internet : 모두 지원
- 별도 PNG 폴백 불필요

---

## 새 이미지 추가 시 작업 순서

1. 원본 PNG 를 적절한 `public/images/{CATEGORY}/` 폴더에 넣는다
2. `node scripts/convert-all-to-webp.cjs` 실행 → 자동으로 PNG → WebP 변환 + 원본 삭제
3. URL 빌더 또는 직접 경로에서 `.webp` 확장자로 참조

캐릭터 그리드 갱신은 `씹덕전신.png` / `씹덕흉상.png` 교체 후 `node scripts/split-moe-grid.cjs` 한 번 실행.
