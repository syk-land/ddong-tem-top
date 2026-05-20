# 이미지 워터마크 제거 (개발 노트)

## 개요
AI 생성 일러스트의 워터마크(Gemini 다이아몬드, "AI로 생성한 콘텐츠" 텍스트)를 제거하기 위해 Pillow 기반의 자동 검출 + clone stamp 인페인트 스크립트를 사용했다.

## 사용 도구
- 파이썬 가상환경: `/tmp/imgvenv/` (Pillow + numpy)
- WSL2 환경 (시스템 파이썬은 PEP 668로 직접 설치 불가 → venv 격리)

## 검출 방식
- **노란 박스 표시** (사용자가 다이아 위치를 직접 노란 사각형으로 마킹한 PNG): RGB `R>200 & G>200 & B<120` 마스크 → 연결 컴포넌트 → 각 박스 bbox 추출 (다중 박스 지원)
- **다이아몬드 자동 검출** (마킹 없을 때): grayscale 임계 + 4-pointed star 후보(정사각형 비율, fill 0.2~0.7, cvar<18로 무채색 검증)

## 인페인트 방식
1. 박스 안쪽 4px 패딩(노란 테두리 두께 제외)
2. 같은 크기 박스를 좌/우 옆 또는 위쪽 영역에서 가져옴 (`src_offset`)
   - 박스가 페이지 좌측이면 +offset, 우측이면 -offset
   - 큰 박스(>100px)는 -260px로 멀리, 작은 박스는 가까이
   - 어두운 배경(밤하늘 등)은 위쪽에서 복사가 자연스러움
3. 가장자리 14~24px **가우시안 페더링** 으로 부드럽게 블렌드

## 캐시 무효화
브라우저가 옛 이미지를 캐시하지 못하도록 이미지 URL에 `?v=3` 쿼리스트링 부여:
```ts
mainImageUrl() = `/images/main.png?v=3`
tutorialImageUrl(n) = `/images/TUTORIAL/${n}.png?v=3`
```

## 처리된 위치
| 이미지 | 위치 |
| --- | --- |
| `main.png` | 우하단 다이아몬드 (clone stamp 위쪽 -220px) |
| `튜토리얼 1.png` | 마지막 컷 인물 가슴 + 추가 5곳 (노란 박스 표시본 기준) |
| `튜토리얼 2.png` | 두 인물 옷 영역 1곳 |
| `튜토리얼 3.png` | 의자 우측 영역 |
| 신규본 `튜토리얼 1·2` | 좌하단 "✦ AI로 생성한 콘텐츠" 텍스트 |

## 산출물
- `public/images/main.png` (덮어씀)
- `public/images/TUTORIAL/{1,2,3}.png` (신규)
- `public/images/REALBOSS/{11개 테마}.png` (`images/realboss.png` 11컷 분할)
- `public/images/main.original.png` — 원본 백업 (`.gitignore` 처리)

## 관련 파일 / 메모
- 일회성 처리. 새 이미지가 들어오면 같은 venv 스크립트로 다시 처리.
- 백업본 `public/images/main.original.png`는 절대 사용처에서 참조하지 않음 (롤백 시에만 수동 사용).
