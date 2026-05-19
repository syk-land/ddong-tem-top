// ============================================================
// 사운드 시스템 — Web Audio API 기반 프로시저럴 SFX
// ============================================================
// 외부 mp3/wav 없이 oscillator+envelope으로 8bit-style 효과음 생성.
// 음소거 토글 + 음량 localStorage 영속화.
//
// 사용:
//   sfx.attack(), sfx.hit(), sfx.crit(), sfx.skill(), sfx.death(), ...
//
// 모든 함수는 AudioContext lazy init. 첫 사용자 인터랙션 후 활성화 (브라우저 정책).

interface SoundConfig {
  enabled: boolean
  volume: number  // 0~1
}

const STORAGE_KEY = 'climetop:sound:v1'

function loadConfig(): SoundConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SoundConfig>
      return {
        enabled: parsed.enabled ?? true,
        volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : 0.3,
      }
    }
  } catch {}
  return { enabled: true, volume: 0.3 }
}

function saveConfig(cfg: SoundConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
  } catch {}
}

let config = loadConfig()

let audioCtx: AudioContext | null = null
function getCtx(): AudioContext | null {
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
}

function playTone(opts: ToneOpts) {
  if (!config.enabled) return
  const ctx = getCtx()
  if (!ctx) return

  // 정지된 상태일 경우 재시작 시도
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }

  const now = ctx.currentTime
  const dur = opts.duration / 1000
  const attack = (opts.attack ?? 5) / 1000
  const release = (opts.release ?? 30) / 1000
  const localGain = (opts.gain ?? 1) * config.volume

  const osc = ctx.createOscillator()
  const gainNode = ctx.createGain()

  osc.type = opts.type ?? 'square'
  osc.frequency.setValueAtTime(opts.freq, now)
  if (opts.freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqEnd), now + dur)
  }

  // envelope: 0 → localGain (attack) → localGain (sustain) → 0 (release)
  gainNode.gain.setValueAtTime(0, now)
  gainNode.gain.linearRampToValueAtTime(localGain, now + attack)
  gainNode.gain.setValueAtTime(localGain, now + dur - release)
  gainNode.gain.linearRampToValueAtTime(0, now + dur)

  osc.connect(gainNode)
  gainNode.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + dur + 0.05)
}

// 노이즈 (찰칵·타격 등 비주기 사운드용)
function playNoise(durationMs: number, gain = 1, filterFreq = 2000) {
  if (!config.enabled) return
  const ctx = getCtx()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})

  const now = ctx.currentTime
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
  filter.frequency.setValueAtTime(filterFreq, now)

  const gainNode = ctx.createGain()
  gainNode.gain.setValueAtTime(localGain, now)
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + dur)

  noise.connect(filter)
  filter.connect(gainNode)
  gainNode.connect(ctx.destination)
  noise.start(now)
  noise.stop(now + dur + 0.05)
}

// ============================================================
// 고수준: 게임 이벤트별 SFX 프리셋
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
    playTone({ freq: 1320, type: 'square', duration: 100, gain: 0.5 })
  },

  // 스킬 — 마법 느낌 sweep
  skill() {
    playTone({ freq: 220, freqEnd: 880, type: 'triangle', duration: 200, gain: 0.4 })
  },

  // 마법 — 더 높은 sweep
  magic() {
    playTone({ freq: 660, freqEnd: 1760, type: 'sine', duration: 250, gain: 0.4 })
    playTone({ freq: 880, freqEnd: 1320, type: 'triangle', duration: 200, gain: 0.3 })
  },

  // 회피 — 짧은 휘파람
  miss() {
    playTone({ freq: 1200, freqEnd: 600, type: 'sine', duration: 80, gain: 0.25 })
  },

  // 픽업 (아이템/골드) — 상승음
  pickup() {
    playTone({ freq: 660, type: 'triangle', duration: 60, gain: 0.4 })
    setTimeout(() => playTone({ freq: 990, type: 'triangle', duration: 80, gain: 0.4 }), 60)
  },

  // 골드 획득
  gold() {
    playTone({ freq: 1320, type: 'sine', duration: 50, gain: 0.3 })
    setTimeout(() => playTone({ freq: 1980, type: 'sine', duration: 70, gain: 0.3 }), 50)
  },

  // 사망 — 하강음
  death() {
    playTone({ freq: 220, freqEnd: 55, type: 'sawtooth', duration: 600, gain: 0.5 })
  },

  // 승리 — 팡파레
  victory() {
    const notes = [523, 659, 784, 1046]  // C-E-G-C
    notes.forEach((f, i) => setTimeout(() => playTone({ freq: f, type: 'square', duration: 150, gain: 0.4 }), i * 100))
  },

  // 레벨업/등급 향상
  rankUp() {
    const notes = [440, 554, 659, 880]
    notes.forEach((f, i) => setTimeout(() => playTone({ freq: f, type: 'triangle', duration: 100, gain: 0.4 }), i * 70))
  },

  // 클릭 / UI 인터랙션
  click() {
    playTone({ freq: 660, type: 'square', duration: 30, gain: 0.2 })
  },

  // 화면 전환 / 챕터 진입
  transition() {
    playTone({ freq: 330, freqEnd: 660, type: 'sine', duration: 150, gain: 0.3 })
  },
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
  config.enabled = v
  saveConfig(config)
}

export function setSoundVolume(v: number) {
  config.volume = Math.max(0, Math.min(1, v))
  saveConfig(config)
}

export function toggleSound() {
  setSoundEnabled(!config.enabled)
}
