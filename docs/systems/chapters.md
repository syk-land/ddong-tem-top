# 챕터 / 몬스터 시스템

## 11개 테마 (`ChapterTheme`)
탑 10개 챕터는 다음 11개 테마 풀에서 매 런마다 무작위 배정 (중복 없음, 한 챕터에 하나).
| 테마 | 일반 이름 | 하드 이름 | 특징 |
| --- | --- | --- | --- |
| 고블린 | 고블린 군락 | 고블린 해방군 | 다수 출몰, 연계 공격 |
| 골렘 | 골렘의 무덤 | 고대 마도 골렘 | 단일, 고방어 |
| 언데드 | 언데드 미궁 | 저주받은 군대 | 부활, 최대 HP 디버프 |
| 환영 | 환영의 숲 | 신기루 환영 | 회피, 환술 |
| 흡혈귀 | 흡혈귀의 성 | 블러드 로드 | 흡혈, 출혈 |
| 심해 | 심해의 침수 구역 | 심해의 압박 | 둔화, 턴 제한 |
| 기계 | 기계 장치 탑 | 자동화 공장 | 포탑, 자폭 |
| 용암 | 용암 동굴 | 종말의 화산 | 화상, 반사 |
| 암흑 | 암흑 신전 | 공허의 심연 | 시야, 침묵 |
| 천공 | 천공의 성 | 폭풍의 제단 | 비행, 환경 |
| 맹독 | 맹독의 늪 | 치명적 역병 | 중독, 회복 감소 |

## 챕터 구성 (10층)
1. 일반 몬스터 (1~3마리)
2. 일반 몬스터 또는 상점
3. 일반 몬스터
4. 보물상자 또는 치유샘
5. 일반 몬스터
6. 상점 또는 특별 이벤트
7. 일반 몬스터
8. 보물상자 또는 치유샘
9. 일반 몬스터 또는 특별 이벤트
10. **보스**

층 구성은 챕터별로 약간씩 변동 (`makeChapterFloors`).

## 몬스터 베이스 스탯
```
일반: HP = 25 + 10N, atk = 5 + 2N, def = 2 + 1.2N, 속도 8
보스: HP × 4.3, atk × 1.3, def × 1.3, 속도 10  (v4 밸런싱)
미믹: 보스의 70% 강도 + 속도 8
```
(N = 챕터 번호)

## 챕터 강도 (Hard 모드)
- 일부 챕터는 `isHard: true` → `hardBoss` 사용 (`baseName` 대신 `hardName`)
- HP/공격력/방어력 모두 +10~20%

## 몬스터 카운트
- `encounterMin / encounterMax` — 일반 전투 시 출현 마릿수 범위
- 약한 테마(고블린): 2~3마리
- 강한 테마(골렘, 심해): 1마리

## 보스 / 미믹 가중치
- 보스 처치 시 아이템 드랍 가중치 ↑
- 미믹: 보물상자 진입 시 10% 확률로 등장 (보스의 70% 강도)
- "item_block" 트레잇(그리폰) 보유 적이 전투에 있으면 모든 드랍 차단

## 관련 파일
- `src/data/chapters.ts` — `CHAPTER_THEMES`, `getNormalMonsterBaseline / getBossBaseline / getMimicBaseline`
- `src/core/tower.ts` — `makeTowerRun / makeChapterFloors / advanceFloor`
- `src/core/combat.ts` — `makeMonster`
- `src/types/index.ts` — `ChapterTheme / ChapterThemeDef / MonsterTemplate / MonsterInstance`
- `src/ui/images.ts` — `monsterImageUrl / themeBgUrl`
