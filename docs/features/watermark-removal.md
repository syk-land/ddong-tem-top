# 이미지 워터마크 제거 (도구)

> Pillow + clone stamp 인페인트로 일러스트의 워터마크 제거. **개발 시 1회성 도구** — 게임 런타임에는 사용 안 함.

---

## 배경

게임에서 사용하는 일러스트 일부에 외부 도구의 워터마크가 들어 있었음. 개발 시점에 Python 헬퍼 스크립트로 제거했다.

---

## 처리 방식

1. 원본 이미지 `images/` 에 보관 (gitignored)
2. 워터마크 위치를 노란 박스 마킹 파일로 별도 표시 (e.g. `images/튜토리얼 1 mark.png`)
3. Python (Pillow + numpy) 으로:
   - 노란 박스 영역 탐지
   - 주변 픽셀 패턴으로 clone stamp 인페인트
4. 결과를 `public/images/` 에 복사 → 게임이 사용

---

## 백업

- 원본 (워터마크 있음): `public/images/main.original.png` 등 → **gitignored**
- 가공 결과: `public/images/*.png` → 커밋

만약 다시 처리해야 한다면:
1. 원본을 `images/` 에 복원
2. 노란 박스 마킹 다시 표시
3. 스크립트 재실행

---

## 알려진 잔여 흔적

t1 / t2 인페인트 결과에 미세한 자국이 남을 수 있음. 자국이 보이면:
- 같은 위치에 노란 박스 마킹을 더 정확히 표시
- 스크립트 재실행

---

## 가상환경

스크립트는 `.venv_imgcrop/` Python 가상환경 (gitignored). 설치:

```bash
python -m venv .venv_imgcrop
source .venv_imgcrop/bin/activate     # Linux/macOS
.venv_imgcrop/Scripts/activate         # Windows
pip install pillow numpy
```

스크립트 자체는 현재 저장소에 포함되지 않음 (개발자 로컬). 필요 시 별도 요청.

---

## 향후

- 워터마크가 없는 자체 일러스트로 점진적 교체
- 또는 정식 라이선스 자산으로 교체

게임 런타임에는 영향 없는 개발 도구 기록.
