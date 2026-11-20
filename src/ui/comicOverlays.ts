// ============================================================
// 만화 이미지의 한글 말풍선 → 영어 오버레이 데이터
// ============================================================
// 인트로(TUTORIAL)·진짜보스 인트로(REALBOSS)·보스 도감(COMIC) 의 말풍선이
// 그림에 픽셀로 박혀 있어, 영어 검수 시 노출된다. 영어 모드일 때만 각 말풍선
// 위치에 흰 박스 + 영어 텍스트를 얹어 가린다 (ComicImage.vue 가 렌더).
//
// 좌표는 원본 이미지 기준 백분율. top = 말풍선 세로 '중심', left = 박스 좌측 끝,
// width = 박스 너비. fs = 컨테이너 너비 대비 cqw(=1% width) 폰트 크기.
// (좌표는 % 격자를 얹어 실측 + 영어 박스를 원본에 합성해 정렬 검증함)
//
// key 규칙: imageUrl 에서 `/images/` 뒤 경로의 확장자/쿼리 제거.
//   예) `.../images/TUTORIAL/1.webp?v=3` → `TUTORIAL/1`
//       `.../images/COMIC/3-2.webp`      → `COMIC/3-2`
// ============================================================

export type ComicBubble = { top: number; left: number; width: number; fs: number; text: string }
export type ComicMeta = { aspect: string; bubbles: ComicBubble[] }

export function comicKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const m = url.match(/\/images\/(.+?)\.(webp|png|jpg|jpeg)(\?.*)?$/i)
  return m ? m[1] : null
}

export const COMIC_OVERLAYS: Record<string, ComicMeta> = {
  // TUTORIAL/1~3 및 REALBOSS/realboss_intro 는 텍스트리스 일러스트 + 네이티브 UI 자막으로 교체됨.

  // ── 보스 도감 만화 (세로 스트립) ───────────────
  'COMIC/1-1': { aspect: '479 / 1024', bubbles: [
    { top: 7,  left: 47, width: 23, fs: 3.0, text: 'This isn’t enough…' },
    { top: 37, left: 8,  width: 20, fs: 3.0, text: '1st death' },
    { top: 37, left: 50, width: 23, fs: 2.9, text: 'Must use area magic.' },
    { top: 82, left: 74, width: 22, fs: 2.9, text: 'All of it, at once.' },
  ] },
  'COMIC/1-2': { aspect: '479 / 1024', bubbles: [
    { top: 13, left: 28, width: 22, fs: 3.2, text: 'I did it…!' },
  ] },
  'COMIC/2-1': { aspect: '479 / 1024', bubbles: [
    { top: 7,  left: 6,  width: 26, fs: 2.9, text: 'The patterns… too fast.' },
    { top: 38, left: 9,  width: 19, fs: 3.0, text: '1st death' },
    { top: 39, left: 50, width: 22, fs: 2.8, text: 'Seize the summons first.' },
    { top: 86, left: 74, width: 22, fs: 2.8, text: 'I’ll use your weapons well.' },
  ] },
  'COMIC/2-2': { aspect: '479 / 1024', bubbles: [
    { top: 8,  left: 30, width: 24, fs: 3.0, text: 'Outsmarting them is the fun part.' },
  ] },
  'COMIC/3-1': { aspect: '479 / 1024', bubbles: [
    { top: 20, left: 33, width: 22, fs: 3.0, text: 'I have to keep dodging.' },
    { top: 38, left: 22, width: 18, fs: 3.0, text: '1st death' },
    { top: 39, left: 50, width: 20, fs: 3.0, text: 'Take it head-on.' },
    { top: 67, left: 74, width: 20, fs: 3.0, text: 'Is this the end?!' },
  ] },
  'COMIC/3-2': { aspect: '479 / 1024', bubbles: [
    { top: 26, left: 49, width: 22, fs: 3.2, text: 'The heavens favor me!!' },
  ] },
  'COMIC/4-1': { aspect: '479 / 1024', bubbles: [
    { top: 26, left: 28, width: 20, fs: 3.0, text: 'Magic won’t work…?' },
    { top: 37, left: 8,  width: 18, fs: 3.0, text: '1st death' },
    { top: 39, left: 50, width: 18, fs: 3.0, text: 'Go in head-on.' },
    { top: 64, left: 74, width: 20, fs: 2.9, text: 'I’ll smash it by hand.' },
  ] },
  'COMIC/4-2': { aspect: '479 / 1024', bubbles: [
    { top: 30, left: 50, width: 18, fs: 3.2, text: 'Honest strength wins.' },
  ] },
  'COMIC/5-1': { aspect: '479 / 1024', bubbles: [
    { top: 6,  left: 30, width: 20, fs: 3.0, text: 'Which one is real?' },
    { top: 39, left: 12, width: 22, fs: 3.0, text: '1st death' },
    { top: 41, left: 50, width: 20, fs: 2.7, text: 'My attack mustn’t return to me.' },
    { top: 65, left: 74, width: 16, fs: 3.2, text: 'Found it.' },
  ] },
  'COMIC/5-2': { aspect: '479 / 1024', bubbles: [
    { top: 35, left: 50, width: 20, fs: 3.2, text: 'Mirrors can’t stop me.' },
  ] },
  'COMIC/6-1': { aspect: '479 / 1024', bubbles: [
    { top: 24, left: 37, width: 22, fs: 3.0, text: 'I can’t just hold out…' },
    { top: 38, left: 21, width: 22, fs: 3.0, text: '1st death' },
    { top: 38, left: 52, width: 18, fs: 2.9, text: 'End it — fast.' },
    { top: 71, left: 70, width: 24, fs: 2.8, text: 'Before the curse stacks.' },
  ] },
  'COMIC/6-2': { aspect: '479 / 1024', bubbles: [
    { top: 39, left: 50, width: 22, fs: 3.0, text: 'Time itself was the weapon.' },
  ] },
  'COMIC/7-1': { aspect: '479 / 1024', bubbles: [
    { top: 7,  left: 30, width: 22, fs: 3.0, text: 'Before it heals…' },
    { top: 33, left: 10, width: 22, fs: 3.0, text: '1st death' },
    { top: 36, left: 52, width: 18, fs: 2.9, text: 'End it in one strike.' },
    { top: 72, left: 72, width: 22, fs: 3.2, text: 'I’m faster.' },
  ] },
  'COMIC/7-2': { aspect: '479 / 1024', bubbles: [
    { top: 26, left: 48, width: 27, fs: 3.0, text: 'No one can keep up now.' },
  ] },
  'COMIC/8-1': { aspect: '479 / 1024', bubbles: [
    { top: 7,  left: 6,  width: 20, fs: 3.0, text: 'Running out of air…' },
    { top: 24, left: 28, width: 22, fs: 3.0, text: 'Aim for the core…' },
    { top: 41, left: 6,  width: 22, fs: 3.0, text: '1st death' },
    { top: 39, left: 50, width: 20, fs: 2.8, text: 'Everything on one shot.' },
    { top: 67, left: 80, width: 12, fs: 3.4, text: 'Done.' },
  ] },
  'COMIC/8-2': { aspect: '479 / 1024', bubbles: [
    { top: 24, left: 46, width: 26, fs: 3.0, text: 'Hesitate, and you lose.' },
  ] },
  'COMIC/9-1': { aspect: '479 / 1024', bubbles: [
    { top: 6,  left: 6,  width: 22, fs: 3.0, text: 'My attacks come back at me…' },
    { top: 37, left: 22, width: 20, fs: 3.0, text: '1st death' },
    { top: 40, left: 52, width: 20, fs: 2.8, text: 'Endure, then strike true.' },
    { top: 65, left: 72, width: 22, fs: 2.7, text: 'Took a while, but it finally falls.' },
  ] },
  'COMIC/9-2': { aspect: '479 / 1024', bubbles: [
    { top: 8,  left: 30, width: 24, fs: 3.0, text: 'Strength isn’t speed.' },
  ] },
  'COMIC/10-1': { aspect: '479 / 1024', bubbles: [
    { top: 24, left: 34, width: 20, fs: 3.0, text: 'My energy won’t gather…' },
    { top: 37, left: 22, width: 20, fs: 3.0, text: '1st death' },
    { top: 38, left: 52, width: 18, fs: 2.9, text: 'Strong even without ki.' },
    { top: 92, left: 74, width: 22, fs: 2.8, text: 'My body is the weapon.' },
  ] },
  'COMIC/10-2': { aspect: '479 / 1024', bubbles: [
    { top: 46, left: 38, width: 24, fs: 3.0, text: 'In the end, only I remain.' },
  ] },
  'COMIC/11-1': { aspect: '479 / 1024', bubbles: [
    { top: 28, left: 6,  width: 24, fs: 3.0, text: 'Healing… turns to poison?' },
    { top: 43, left: 10, width: 20, fs: 3.0, text: '1st death' },
    { top: 44, left: 50, width: 20, fs: 2.9, text: 'I don’t need healing.' },
    { top: 95, left: 80, width: 18, fs: 3.2, text: 'Let’s end this.' },
  ] },
  'COMIC/11-2': { aspect: '479 / 1024', bubbles: [
    { top: 83, left: 47, width: 34, fs: 2.7, text: 'This is the end!! I beat them all!!!' },
  ] },
}
