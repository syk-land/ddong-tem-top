// ============================================================
// 사운드 시스템 — Web Audio API 기반 프로시저럴 SFX + BGM
// ============================================================
// 외부 mp3/wav 없이 oscillator+envelope으로 8bit-style 효과음 생성.
// 음소거 토글 + 음량 localStorage 영속화.
//
// 사용:
//   sfx.attack(), sfx.crit(), sfx.click(), …
//   sfx.skills['화염구']()      → 스킬별 고유 사운드
//   sfx.monsterHit('metal')    → 몬스터 카테고리 피격음
//   sfx.monsterDeath('beast')  → 몬스터 카테고리 사망음
//   playBgm('splash' | 'menu') → BGM 재생 (loop)
//   stopBgm()                  → BGM 정지
//
// 모든 함수는 AudioContext lazy init. 첫 사용자 인터랙션 후 활성화 (브라우저 정책).
// 시뮬레이터 등 window 가 없는 환경에서도 안전 (noop).

interface SoundConfig {
  enabled: boolean
  volume: number  // 0~1 (SFX)
  bgmVolume: number  // 0~1 (BGM 별도)
  bgmEnabled: boolean
}

const STORAGE_KEY = 'climetop:sound:v1'
const IS_BROWSER = typeof window !== 'undefined'

function loadConfig(): SoundConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SoundConfig>
      return {
        enabled: parsed.enabled ?? true,
        volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : 0.3,
        bgmVolume: typeof parsed.bgmVolume === 'number' ? Math.max(0, Math.min(1, parsed.bgmVolume)) : 0.4,
        bgmEnabled: parsed.bgmEnabled ?? true,
      }
    }
  } catch {}
  return { enabled: true, volume: 0.3, bgmVolume: 0.4, bgmEnabled: true }
}

function saveConfig(cfg: SoundConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
  } catch {}
}

let config = loadConfig()

let audioCtx: AudioContext | null = null
function getCtx(): AudioContext | null {
  if (!IS_BROWSER) return null
  if (audioCtx) return audioCtx
  try {
    const AC: typeof AudioContext = (window as any).AudioContext ?? (window as any).webkitAudioContext
    if (!AC) return null
    audioCtx = new AC()
    return audioCtx
  } catch {
    return null
  }
}

// ============================================================
// 저수준: 한 음표 재생 (oscillator + envelope)
// ============================================================
interface ToneOpts {
  freq: number       // Hz
  type?: OscillatorType  // 'sine' | 'square' | 'sawtooth' | 'triangle'
  duration: number   // ms
  attack?: number    // 0~duration ms — 0 = 즉시 풀음량
  release?: number   // duration 끝의 페이드아웃 ms
  freqEnd?: number   // freq sweep 목표 (없으면 일정)
  gain?: number      // 0~1 음량 곱
  detune?: number    // 음정 디튠 (cents)
  delay?: number     // 시작 지연 (ms)
}

function playTone(opts: ToneOpts) {
  if (!config.enabled) return
  const ctx = getCtx()
  if (!ctx) return

  // 정지된 상태일 경우 재시작 시도
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }

  const startAt = ctx.currentTime + (opts.delay ?? 0) / 1000
  const dur = opts.duration / 1000
  const attack = (opts.attack ?? 5) / 1000
  const release = (opts.release ?? 30) / 1000
  const localGain = (opts.gain ?? 1) * config.volume

  const osc = ctx.createOscillator()
  const gainNode = ctx.createGain()

  osc.type = opts.type ?? 'square'
  osc.frequency.setValueAtTime(opts.freq, startAt)
  if (opts.detune !== undefined) osc.detune.setValueAtTime(opts.detune, startAt)
  if (opts.freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqEnd), startAt + dur)
  }

  // envelope: 0 → localGain (attack) → localGain (sustain) → 0 (release)
  gainNode.gain.setValueAtTime(0, startAt)
  gainNode.gain.linearRampToValueAtTime(localGain, startAt + attack)
  gainNode.gain.setValueAtTime(localGain, startAt + dur - release)
  gainNode.gain.linearRampToValueAtTime(0, startAt + dur)

  osc.connect(gainNode)
  gainNode.connect(ctx.destination)
  osc.start(startAt)
  osc.stop(startAt + dur + 0.05)
}

// 노이즈 (찰칵·타격 등 비주기 사운드용)
function playNoise(durationMs: number, gain = 1, filterFreq = 2000, delayMs = 0) {
  if (!config.enabled) return
  const ctx = getCtx()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})

  const startAt = ctx.currentTime + delayMs / 1000
  const dur = durationMs / 1000
  const localGain = gain * config.volume * 0.5  // noise는 좀 작게

  // 화이트 노이즈 버퍼 생성
  const sampleRate = ctx.sampleRate
  const bufferSize = Math.floor(sampleRate * dur)
  const buffer = ctx.createBuffer(1, bufferSize, sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

  const noise = ctx.createBufferSource()
  noise.buffer = buffer

  // 저역 필터 통과로 high-freq 톤을 줄임
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(filterFreq, startAt)

  const gainNode = ctx.createGain()
  gainNode.gain.setValueAtTime(localGain, startAt)
  gainNode.gain.exponentialRampToValueAtTime(0.001, startAt + dur)

  noise.connect(filter)
  filter.connect(gainNode)
  gainNode.connect(ctx.destination)
  noise.start(startAt)
  noise.stop(startAt + dur + 0.05)
}

// ============================================================
// 고수준: 기본 게임 이벤트별 SFX 프리셋
// ============================================================
export const sfx = {
  // 평타 — 짧은 둔탁 (square 440 → 220 sweep)
  attack() {
    playTone({ freq: 440, freqEnd: 220, type: 'square', duration: 80, attack: 2, release: 30, gain: 0.5 })
  },

  // 피격 — 노이즈 + 낮은 톤
  hit() {
    playNoise(60, 0.6, 800)
    playTone({ freq: 200, freqEnd: 120, type: 'sawtooth', duration: 80, gain: 0.4 })
  },

  // 크리티컬 — 고음 알림
  crit() {
    playTone({ freq: 880, type: 'square', duration: 60, gain: 0.5 })
    playTone({ freq: 1320, type: 'square', duration: 100, gain: 0.5, delay: 40 })
  },

  // 스킬 — 마법 느낌 sweep (fallback)
  skill() {
    playTone({ freq: 220, freqEnd: 880, type: 'triangle', duration: 200, gain: 0.4 })
  },

  // 마법 — 더 높은 sweep (fallback)
  magic() {
    playTone({ freq: 660, freqEnd: 1760, type: 'sine', duration: 250, gain: 0.4 })
    playTone({ freq: 880, freqEnd: 1320, type: 'triangle', duration: 200, gain: 0.3 })
  },

  // 회피 — 짧은 휘파람
  miss() {
    playTone({ freq: 1200, freqEnd: 600, type: 'sine', duration: 80, gain: 0.25 })
  },

  // 픽업 (아이템) — 상승음
  pickup() {
    playTone({ freq: 660, type: 'triangle', duration: 60, gain: 0.4 })
    playTone({ freq: 990, type: 'triangle', duration: 80, gain: 0.4, delay: 60 })
  },

  // 골드 획득
  gold() {
    playTone({ freq: 1320, type: 'sine', duration: 50, gain: 0.3 })
    playTone({ freq: 1980, type: 'sine', duration: 70, gain: 0.3, delay: 50 })
  },

  // 사망 — 하강음
  death() {
    playTone({ freq: 220, freqEnd: 55, type: 'sawtooth', duration: 600, gain: 0.5 })
  },

  // 승리 — 팡파레
  victory() {
    const notes = [523, 659, 784, 1046]  // C-E-G-C
    notes.forEach((f, i) => playTone({ freq: f, type: 'square', duration: 150, gain: 0.4, delay: i * 100 }))
  },

  // 레벨업/등급 향상
  rankUp() {
    const notes = [440, 554, 659, 880]
    notes.forEach((f, i) => playTone({ freq: f, type: 'triangle', duration: 100, gain: 0.4, delay: i * 70 }))
  },

  // 클릭 / UI 인터랙션
  click() {
    playTone({ freq: 660, type: 'square', duration: 30, gain: 0.2 })
  },

  // 화면 전환 / 챕터 진입
  transition() {
    playTone({ freq: 330, freqEnd: 660, type: 'sine', duration: 150, gain: 0.3 })
  },

  // ============================================================
  // 스킬별 고유 사운드
  // ============================================================
  skills: {
    // ─── 물리 공격 ───
    스매쉬() {
      // 무거운 둔탁 — 낮은 square down + 노이즈
      playNoise(80, 0.7, 400)
      playTone({ freq: 150, freqEnd: 60, type: 'square', duration: 220, gain: 0.55 })
    },
    피어스() {
      // 빠른 찌르기 — 짧고 날카로운 휘파람
      playTone({ freq: 1400, freqEnd: 2200, type: 'sine', duration: 60, gain: 0.35 })
      playTone({ freq: 700, type: 'square', duration: 50, gain: 0.3, delay: 30 })
    },
    연속공격() {
      // 3연타
      for (let i = 0; i < 3; i++) {
        playTone({ freq: 500 + i * 60, freqEnd: 280 + i * 40, type: 'square', duration: 70, gain: 0.4, delay: i * 70 })
      }
    },
    정밀타격() {
      // 메탈릭 'tink' — 고음 sine + triangle
      playTone({ freq: 1760, type: 'triangle', duration: 80, gain: 0.4 })
      playTone({ freq: 2640, type: 'sine', duration: 120, gain: 0.3, delay: 20 })
    },
    급습() {
      // 빠른 swoosh + 타격
      playNoise(100, 0.4, 3000)
      playTone({ freq: 800, freqEnd: 400, type: 'sawtooth', duration: 150, gain: 0.45, delay: 50 })
    },

    // ─── 물리 방어 ───
    방어() {
      // low thud — 두꺼운 방어막
      playTone({ freq: 110, type: 'square', duration: 180, gain: 0.5 })
      playTone({ freq: 165, type: 'square', duration: 180, gain: 0.3 })
    },
    회피() {
      // 짧은 swoosh
      playNoise(120, 0.45, 4000)
    },
    패링() {
      // metallic clang — sawtooth chord
      playTone({ freq: 880, type: 'sawtooth', duration: 200, gain: 0.4 })
      playTone({ freq: 1318, type: 'triangle', duration: 180, gain: 0.35, delay: 20 })
      playTone({ freq: 1760, type: 'sine', duration: 250, gain: 0.25, delay: 40 })
    },
    불굴의의지() {
      // slow chord build-up — 영웅적
      playTone({ freq: 220, type: 'triangle', duration: 400, gain: 0.4 })
      playTone({ freq: 330, type: 'triangle', duration: 400, gain: 0.4, delay: 80 })
      playTone({ freq: 440, type: 'sine', duration: 500, gain: 0.4, delay: 160 })
    },

    // ─── 마법 공격 (속성별) ───
    빙결의화살() {
      // crystalline — high sine glissando + 떨림
      playTone({ freq: 1760, freqEnd: 2200, type: 'sine', duration: 180, gain: 0.4 })
      playTone({ freq: 2640, type: 'sine', duration: 100, gain: 0.25, delay: 100 })
      playNoise(60, 0.2, 6000, 150)
    },
    화염구() {
      // bass roar + noise burst
      playNoise(180, 0.6, 1500)
      playTone({ freq: 110, freqEnd: 200, type: 'sawtooth', duration: 250, gain: 0.5 })
      playTone({ freq: 330, freqEnd: 660, type: 'square', duration: 200, gain: 0.3, delay: 30 })
    },
    폭풍칼날() {
      // wind noise + multiple high tones
      playNoise(220, 0.5, 5000)
      for (let i = 0; i < 3; i++) {
        playTone({ freq: 1200 + i * 200, type: 'triangle', duration: 80, gain: 0.3, delay: i * 60 })
      }
    },
    바위충격() {
      // deep boom + 잔향
      playTone({ freq: 80, type: 'square', duration: 300, gain: 0.6 })
      playNoise(250, 0.7, 500)
      playTone({ freq: 55, type: 'sawtooth', duration: 400, gain: 0.4, delay: 50 })
    },
    번개창() {
      // sharp crack — filtered noise + high tone
      playNoise(50, 0.8, 8000)
      playTone({ freq: 2200, freqEnd: 4400, type: 'square', duration: 60, gain: 0.4, delay: 20 })
      playTone({ freq: 660, type: 'sawtooth', duration: 150, gain: 0.3, delay: 60 })
    },
    그림자일격() {
      // dark bass swell — descending eerie
      playTone({ freq: 220, freqEnd: 55, type: 'sine', duration: 350, gain: 0.5 })
      playTone({ freq: 330, freqEnd: 110, type: 'triangle', duration: 300, gain: 0.3, delay: 50 })
    },
    정화의광선() {
      // heavenly chord — multiple sines (C-E-G-B)
      const chord = [523, 659, 784, 988]
      chord.forEach((f, i) => playTone({ freq: f, type: 'sine', duration: 400, gain: 0.3, delay: i * 30 }))
      playTone({ freq: 1046, type: 'sine', duration: 500, gain: 0.25, delay: 150 })
    },

    // ─── 마법 방어 ───
    배리어() {
      // rising shimmer
      playTone({ freq: 440, freqEnd: 880, type: 'sine', duration: 300, gain: 0.4 })
      playTone({ freq: 660, freqEnd: 1320, type: 'triangle', duration: 280, gain: 0.3, delay: 50 })
    },
    마력충전() {
      // gentle sparkle — 상승 아르페지오
      const notes = [523, 659, 784, 988, 1175]
      notes.forEach((f, i) => playTone({ freq: f, type: 'triangle', duration: 100, gain: 0.3, delay: i * 50 }))
    },
    저항의결계() {
      // slow pad build — 두꺼운 패드
      playTone({ freq: 110, type: 'triangle', duration: 600, gain: 0.4 })
      playTone({ freq: 165, type: 'sine', duration: 600, gain: 0.3, delay: 100 })
      playTone({ freq: 220, type: 'sine', duration: 600, gain: 0.3, delay: 200 })
      playTone({ freq: 330, type: 'sine', duration: 600, gain: 0.25, delay: 300 })
    },
  },

  // ============================================================
  // 몬스터 카테고리별 피격/사망 사운드
  // ============================================================
  // 카테고리: soft (슬라임/식물), bone (언데드/스켈), metal (기계/골렘),
  //          beast (야수/그리폰), fire (불/용암), magical (영혼/그림자/환영)
  monsterHit(category: MonsterSfxCategory) {
    // 카테고리 음은 평타/스킬 사운드보다 약 30ms 늦게 시작 → 색채를 또렷이 분리
    switch (category) {
      case 'soft':
        // 끈적한 plop — 약간 더 무겁게
        playNoise(100, 0.65, 700, 30)
        playTone({ freq: 180, freqEnd: 80, type: 'sine', duration: 140, gain: 0.5, delay: 30 })
        break
      case 'bone':
        // 마른 rattle — 짧고 건조한
        playNoise(80, 0.7, 3000, 30)
        playTone({ freq: 220, type: 'square', duration: 90, gain: 0.45, delay: 30 })
        playTone({ freq: 330, type: 'square', duration: 60, gain: 0.3, delay: 50 })
        break
      case 'metal':
        // 금속 ring
        playTone({ freq: 1320, type: 'sawtooth', duration: 130, gain: 0.6, delay: 30 })
        playTone({ freq: 1980, type: 'sine', duration: 180, gain: 0.45, delay: 50 })
        playNoise(50, 0.45, 4000, 30)
        break
      case 'beast':
        // yelp/growl — 낮은 동물 신음
        playTone({ freq: 330, freqEnd: 220, type: 'sawtooth', duration: 180, gain: 0.6, delay: 30 })
        playNoise(80, 0.55, 1500, 30)
        break
      case 'fire':
        // sizzle hiss — 화염 피격
        playNoise(140, 0.75, 2500, 30)
        playTone({ freq: 440, freqEnd: 880, type: 'triangle', duration: 130, gain: 0.5, delay: 30 })
        break
      case 'magical':
        // ethereal blur — 환영
        playTone({ freq: 660, freqEnd: 330, type: 'sine', duration: 220, gain: 0.55, delay: 30 })
        playTone({ freq: 990, freqEnd: 495, type: 'triangle', duration: 190, gain: 0.4, delay: 60 })
        break
    }
  },

  monsterDeath(category: MonsterSfxCategory) {
    // 사망음은 처치 직후 단독으로 울리므로 delay 없음, gain 만 강화
    switch (category) {
      case 'soft':
        // 꺼지는 plop
        playNoise(220, 0.75, 500)
        playTone({ freq: 220, freqEnd: 55, type: 'sine', duration: 400, gain: 0.55 })
        break
      case 'bone':
        // 뼈 부서지는 dry crack
        playNoise(170, 0.85, 4000)
        playTone({ freq: 165, freqEnd: 80, type: 'square', duration: 280, gain: 0.55, delay: 30 })
        playTone({ freq: 110, freqEnd: 55, type: 'square', duration: 320, gain: 0.4, delay: 100 })
        break
      case 'metal':
        // 금속 폭발 — 강한 clang + boom
        playTone({ freq: 880, freqEnd: 220, type: 'sawtooth', duration: 330, gain: 0.65 })
        playNoise(280, 0.85, 1500, 50)
        playTone({ freq: 110, freqEnd: 55, type: 'square', duration: 450, gain: 0.55, delay: 100 })
        break
      case 'beast':
        // 동물 death cry (descending)
        playTone({ freq: 440, freqEnd: 110, type: 'sawtooth', duration: 550, gain: 0.65 })
        playNoise(220, 0.55, 2000, 100)
        break
      case 'fire':
        // 화염 꺼지기 — fizzle out
        playNoise(330, 0.75, 800)
        playTone({ freq: 660, freqEnd: 165, type: 'triangle', duration: 400, gain: 0.55 })
        break
      case 'magical':
        // ethereal fade dissolve — 천천히 사라짐
        playTone({ freq: 880, freqEnd: 110, type: 'sine', duration: 750, gain: 0.6 })
        playTone({ freq: 660, freqEnd: 220, type: 'triangle', duration: 650, gain: 0.45, delay: 80 })
        break
    }
  },
}

export type MonsterSfxCategory = 'soft' | 'bone' | 'metal' | 'beast' | 'fire' | 'magical'

// 스킬 키 → 사운드 함수 라우터 (없으면 fallback)
export function playSkillSound(key: string, kind?: string) {
  const fn = (sfx.skills as Record<string, (() => void) | undefined>)[key]
  if (fn) {
    fn()
    return
  }
  // fallback by kind
  if (kind === 'magic_atk' || kind === 'magic_def') sfx.magic()
  else sfx.skill()
}

// ============================================================
// BGM (배경음악) — 절차적 멜로디 시퀀서
// ============================================================
// 두 가지 분위기:
//   - splash:  웅장하고 음울 (C minor, slow tempo)
//   - menu:    몽환적이고 발랄 (C major, mid tempo, bell-like)
// 음표 시퀀스를 setTimeout 으로 스케줄, loopMs 후 자동 반복.

interface BgmNote {
  freq: number          // Hz (0 = rest)
  startMs: number       // 마디 시작부터 오프셋 ms
  durationMs: number    // 음 길이 ms
  type?: OscillatorType
  gain?: number         // 절대 곱 (이미 bgmVolume 적용 안 됨, 함수 내에서 적용)
  attack?: number
  release?: number
}

interface BgmTrack {
  notes: BgmNote[]
  loopMs: number  // 한 루프 길이
}

// ── splash BGM: 웅장/음울 (C minor 90BPM, 1마디 = 2666ms (4/4))
// 멜로디(상): C5 Eb5 G5 Ab5 G5 F5 Eb5 D5 …
// 베이스: C2 - G2 - Ab2 - F2 (느린 워킹)
const SPLASH_BGM: BgmTrack = (() => {
  const notes: BgmNote[] = []
  // 베이스 라인 (4개 음, 길게)
  const bass = [65.4, 65.4, 49.0, 77.8]  // C2 C2 G1 Eb2 (음울)
  bass.forEach((f, i) => {
    notes.push({ freq: f, startMs: i * 1500, durationMs: 1400, type: 'sawtooth', gain: 0.35, attack: 200, release: 300 })
  })
  // 멜로디 (상성부) — 음울한 단조 멜로디
  const mel = [
    { f: 523, off: 0 },     // C5
    { f: 622, off: 600 },   // Eb5
    { f: 783, off: 1200 },  // G5
    { f: 698, off: 1800 },  // F5
    { f: 622, off: 2400 },  // Eb5
    { f: 587, off: 3200 },  // D5
    { f: 523, off: 4000 },  // C5
    { f: 466, off: 4800 },  // Bb4
    { f: 523, off: 5400 },  // C5
  ]
  mel.forEach(({ f, off }) => {
    notes.push({ freq: f, startMs: off, durationMs: 500, type: 'triangle', gain: 0.25, attack: 30, release: 100 })
  })
  return { notes, loopMs: 6000 }
})()

// ── menu BGM: 몽환적/발랄 (C major 120BPM, bell-like)
// 코드 진행: C - G - Am - F (pop progression)
// 멜로디: 상승하는 sine 아르페지오
const MENU_BGM: BgmTrack = (() => {
  const notes: BgmNote[] = []
  // 베이스 (4코드, 각 1000ms)
  const bassNotes = [130.8, 98.0, 110.0, 87.3]  // C3 G2 A2 F2
  bassNotes.forEach((f, i) => {
    notes.push({ freq: f, startMs: i * 1000, durationMs: 900, type: 'triangle', gain: 0.3, attack: 50, release: 150 })
  })
  // 아르페지오 (각 코드 위 3음, 8분음표)
  const arps: number[][] = [
    [523, 659, 784],  // C major
    [392, 587, 784],  // G major
    [440, 523, 659],  // A minor
    [349, 440, 523],  // F major
  ]
  arps.forEach((chord, ci) => {
    const startBase = ci * 1000
    // 1코드당 8개 8분음표 (125ms 간격)
    for (let i = 0; i < 8; i++) {
      const f = chord[i % 3]
      notes.push({
        freq: f,
        startMs: startBase + i * 125,
        durationMs: 120,
        type: 'sine',
        gain: 0.18,
        attack: 5,
        release: 60,
      })
    }
  })
  // 하이라이트 sparkle (랜덤 위치)
  const sparklePositions = [375, 1500, 2625, 3750]
  sparklePositions.forEach(off => {
    notes.push({ freq: 1046, startMs: off, durationMs: 200, type: 'triangle', gain: 0.15, attack: 5, release: 100 })
    notes.push({ freq: 1568, startMs: off + 60, durationMs: 200, type: 'sine', gain: 0.12, attack: 5, release: 100 })
  })
  return { notes, loopMs: 4000 }
})()

const BGM_TRACKS: Record<'splash' | 'menu', BgmTrack> = {
  splash: SPLASH_BGM,
  menu: MENU_BGM,
}

// 외부 MP3 BGM (gemini_music.mp3 등) — HTMLAudioElement 기반
const MP3_BGM_URLS: Record<string, string> = {
  gemini: '/sound/gemini_music.mp3',
}

export type BgmKind = 'splash' | 'menu' | 'gemini'

let bgmTimer: number | null = null
let bgmCurrent: BgmKind | null = null
let bgmScheduledOscillators: { osc: OscillatorNode; gain: GainNode; stopAt: number }[] = []
let bgmAudioEl: HTMLAudioElement | null = null

function scheduleBgmLoop(track: BgmTrack, ctxStartTime: number) {
  const ctx = getCtx()
  if (!ctx) return
  for (const note of track.notes) {
    if (note.freq <= 0) continue
    const startAt = ctxStartTime + note.startMs / 1000
    const dur = note.durationMs / 1000
    const attack = (note.attack ?? 10) / 1000
    const release = (note.release ?? 80) / 1000
    const localGain = (note.gain ?? 0.3) * config.bgmVolume

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = note.type ?? 'sine'
    osc.frequency.setValueAtTime(note.freq, startAt)
    gain.gain.setValueAtTime(0, startAt)
    gain.gain.linearRampToValueAtTime(localGain, startAt + attack)
    gain.gain.setValueAtTime(localGain, startAt + Math.max(attack, dur - release))
    gain.gain.linearRampToValueAtTime(0, startAt + dur)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(startAt)
    osc.stop(startAt + dur + 0.05)
    bgmScheduledOscillators.push({ osc, gain, stopAt: startAt + dur + 0.05 })
  }
}

function clearOldBgmOscillators() {
  if (!IS_BROWSER) return
  const ctx = getCtx()
  if (!ctx) return
  const now = ctx.currentTime
  bgmScheduledOscillators = bgmScheduledOscillators.filter(item => {
    if (item.stopAt < now) return false  // 이미 끝남
    return true
  })
}

// 브라우저 autoplay 정책 우회 — AudioContext 가 suspended 면
// 페이지 첫 사용자 인터랙션(pointer/key/touch) 시 자동으로 BGM 시작.
let pendingBgmKind: BgmKind | null = null
let unlockHandler: ((this: Window, ev: Event) => void) | null = null

function attachUnlockListener() {
  if (!IS_BROWSER || unlockHandler) return
  const handler = () => {
    const ctx = getCtx()
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    if (unlockHandler) {
      window.removeEventListener('pointerdown', unlockHandler)
      window.removeEventListener('keydown', unlockHandler)
      window.removeEventListener('touchstart', unlockHandler)
      unlockHandler = null
    }
    if (pendingBgmKind) {
      const k = pendingBgmKind
      pendingBgmKind = null
      bgmCurrent = null
      playBgm(k)
    }
  }
  unlockHandler = handler
  window.addEventListener('pointerdown', handler, { once: true })
  window.addEventListener('keydown', handler, { once: true })
  window.addEventListener('touchstart', handler, { once: true })
}

export function playBgm(kind: BgmKind) {
  if (!IS_BROWSER) return
  if (bgmCurrent === kind) return  // 이미 같은 BGM
  stopBgm()
  if (!config.bgmEnabled) {
    bgmCurrent = kind  // 토글 켜졌을 때 시작할 수 있게 기억
    return
  }

  // MP3 기반 BGM 분기 (HTMLAudioElement)
  const mp3Url = MP3_BGM_URLS[kind]
  if (mp3Url) {
    bgmCurrent = kind
    try {
      bgmAudioEl = new Audio(mp3Url)
      bgmAudioEl.loop = true
      bgmAudioEl.volume = config.bgmVolume
      const playPromise = bgmAudioEl.play()
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // autoplay 차단 — 첫 인터랙션 시 재시도
          pendingBgmKind = kind
          attachUnlockListener()
        })
      }
    } catch {}
    return
  }

  const ctx = getCtx()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    // autoplay 차단 — 첫 인터랙션 시 자동 재생되도록 예약
    ctx.resume().catch(() => {})
    if (ctx.state === 'suspended') {
      pendingBgmKind = kind
      bgmCurrent = kind  // UI 토글이 즉시 반영되도록 기억만 해둠
      attachUnlockListener()
      return
    }
  }

  const track = BGM_TRACKS[kind as 'splash' | 'menu']
  if (!track) return
  bgmCurrent = kind

  // 첫 루프 즉시 스케줄, 이후 setInterval 로 반복
  scheduleBgmLoop(track, ctx.currentTime)
  bgmTimer = (setInterval(() => {
    const c = getCtx()
    if (!c) return
    clearOldBgmOscillators()
    scheduleBgmLoop(track, c.currentTime)
  }, track.loopMs) as unknown) as number
}

export function stopBgm() {
  if (!IS_BROWSER) return
  if (bgmTimer !== null) {
    clearInterval(bgmTimer)
    bgmTimer = null
  }
  // MP3 BGM 정지 (페이드아웃)
  if (bgmAudioEl) {
    try {
      const el = bgmAudioEl
      const startVol = el.volume
      const steps = 8
      let i = 0
      const fadeTimer = setInterval(() => {
        i++
        try { el.volume = Math.max(0, startVol * (1 - i / steps)) } catch {}
        if (i >= steps) {
          clearInterval(fadeTimer)
          try { el.pause(); el.src = '' } catch {}
        }
      }, 20)
    } catch {}
    bgmAudioEl = null
  }
  // 현재 재생 중인 모든 BGM 오실레이터를 빠르게 페이드아웃
  const ctx = getCtx()
  if (ctx) {
    const now = ctx.currentTime
    const fade = 0.15
    for (const item of bgmScheduledOscillators) {
      try {
        item.gain.gain.cancelScheduledValues(now)
        item.gain.gain.setValueAtTime(item.gain.gain.value, now)
        item.gain.gain.linearRampToValueAtTime(0, now + fade)
        item.osc.stop(now + fade + 0.05)
      } catch {}
    }
  }
  bgmScheduledOscillators = []
  bgmCurrent = null
}

export function getCurrentBgm(): BgmKind | null {
  return bgmCurrent
}

// ============================================================
// 설정 토글 / 음량 변경
// ============================================================
export function isSoundEnabled(): boolean {
  return config.enabled
}

export function getSoundVolume(): number {
  return config.volume
}

export function setSoundEnabled(v: boolean) {
  // SFX 만 제어 — BGM 은 setBgmEnabled 로 분리
  config.enabled = v
  saveConfig(config)
}

export function setSoundVolume(v: number) {
  config.volume = Math.max(0, Math.min(1, v))
  saveConfig(config)
}

export function setBgmVolume(v: number) {
  config.bgmVolume = Math.max(0, Math.min(1, v))
  saveConfig(config)
  if (bgmAudioEl) {
    try { bgmAudioEl.volume = config.bgmVolume } catch {}
  }
}

export function getBgmVolume(): number {
  return config.bgmVolume
}

export function isBgmEnabled(): boolean {
  return config.bgmEnabled
}

export function setBgmEnabled(v: boolean) {
  config.bgmEnabled = v
  saveConfig(config)
  if (!v) {
    // BGM off — 트랙은 정지하지만 bgmCurrent 는 기억 (재활성 시 같은 트랙 재개)
    const remembered = bgmCurrent
    stopBgm()
    bgmCurrent = remembered
  } else if (bgmCurrent) {
    const kind = bgmCurrent
    bgmCurrent = null  // playBgm 중복 체크 우회
    playBgm(kind)
  }
}

export function toggleSound() {
  setSoundEnabled(!config.enabled)
}
