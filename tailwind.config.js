/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Consolas', 'Menlo', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // 배경
        bg: {
          primary: '#0a0e1a',
          secondary: '#141826',
          tertiary: '#1f2336',
          panel: '#1a1f30',
          hover: '#262b3e',
        },

        // 4-등급 (노말/레어/스페셜/레전드) — Diablo/POE 컨벤션
        grade: {
          normal: '#9ca3af',    // 회색
          rare: '#3b82f6',      // 파랑
          special: '#a855f7',   // 보라
          legend: '#f59e0b',    // 황금
        },

        // 4-트레잇 (하급/보통/희귀/특별)
        trait: {
          low: '#6b7280',       // 짙은 회색 (잡템)
          common: '#e5e7eb',    // 흰색
          rare: '#60a5fa',      // 밝은 파랑
          special: '#fbbf24',   // 노랑 (고유효과)
        },

        // 6-상태이상
        status: {
          burn: '#ef4444',      // 점화: 빨강
          bleed: '#dc2626',     // 출혈: 진한 빨강
          poison: '#16a34a',    // 독: 초록
          slow: '#0ea5e9',      // 둔화: 시안
          blind: '#7c3aed',     // 암흑: 보라
          shock: '#facc15',     // 감전: 노랑
        },

        // 스탯 카테고리
        stat: {
          phys_atk: '#fca5a5',  // 물공: 연한 빨강
          mag_atk: '#c4b5fd',   // 마공: 연한 보라
          phys_def: '#93c5fd',  // 물방: 연한 파랑
          mag_def: '#a5b4fc',   // 마방: 연한 인디고
          hp: '#86efac',        // 체력: 연한 초록
          mp: '#7dd3fc',        // 마력: 하늘
          speed: '#fcd34d',     // 속도: 노랑
          luck: '#fde047',      // 행운: 황금
          util: '#cbd5e1',      // 명중/회피/관통/저항
        },

        // 전투 로그
        log: {
          player: '#5eead4',    // 플레이어 액션 (청록 teal-300)
          enemy: '#fb7185',     // 적 액션 (rose-400)
          critical: '#fbbf24',  // 크리티컬 (amber-400)
          miss: '#64748b',      // 빗나감
          heal: '#34d399',      // 회복
          damage: '#22d3ee',    // 플레이어가 가한 데미지 (cyan-400)
          status: '#a78bfa',    // 상태이상 발동
          mp: '#38bdf8',        // MP 사용
          skill: '#06b6d4',     // 스킬 사용
          gold: '#fcd34d',      // 골드 획득
          info: '#94a3b8',      // 시스템 정보
          reward: '#fbbf24',    // 보상
        },

        // 클리어 등급
        rank: {
          F: '#6b7280',
          E: '#9ca3af',
          D: '#94a3b8',
          C: '#cbd5e1',
          B: '#e2e8f0',
          A: '#60a5fa',
          S: '#a855f7',
          SS: '#f59e0b',
          SSS: '#ec4899',
          EX: '#fbbf24',
        },

        // 챕터 테마
        theme: {
          goblin: '#65a30d',
          golem: '#78716c',
          undead: '#a855f7',
          mirage: '#ec4899',
          vampire: '#991b1b',
          deep: '#0891b2',
          machine: '#475569',
          lava: '#ea580c',
          dark: '#1e1b4b',
          sky: '#0ea5e9',
          venom: '#84cc16',
        },

        // HP/MP 바
        bar: {
          hp_full: '#22c55e',
          hp_mid: '#eab308',
          hp_low: '#ef4444',
          mp: '#3b82f6',
        },
      },
      animation: {
        'log-fade': 'log-fade 200ms ease-out forwards',
        'damage-pop': 'damage-pop 600ms ease-out forwards',
        'critical-flash': 'critical-flash 400ms ease-out',
        'pulse-low': 'pulse-low 1s ease-in-out infinite',
        'ex-shimmer': 'ex-shimmer 2s linear infinite',
        'shake': 'shake 280ms ease-in-out',
        'shake-strong': 'shake-strong 400ms ease-in-out',
        'damage-float': 'damage-float 900ms ease-out forwards',
        'flash-red': 'flash-red 280ms ease-out',
      },
      keyframes: {
        'log-fade': {
          'from': { opacity: '0', transform: 'translateX(-4px)' },
          'to': { opacity: '1', transform: 'translateX(0)' },
        },
        'damage-pop': {
          'from': { transform: 'scale(0.5)', opacity: '0' },
          '30%': { transform: 'scale(1.2)', opacity: '1' },
          'to': { transform: 'scale(1)', opacity: '0' },
        },
        'critical-flash': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.15)', filter: 'brightness(1.5)' },
        },
        'pulse-low': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'ex-shimmer': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-6px) rotate(-2deg)' },
          '40%': { transform: 'translateX(5px) rotate(2deg)' },
          '60%': { transform: 'translateX(-4px) rotate(-1deg)' },
          '80%': { transform: 'translateX(3px) rotate(1deg)' },
        },
        'shake-strong': {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%': { transform: 'translateX(-10px) rotate(-4deg)' },
          '35%': { transform: 'translateX(9px) rotate(4deg)' },
          '55%': { transform: 'translateX(-7px) rotate(-2deg)' },
          '80%': { transform: 'translateX(5px) rotate(2deg)' },
        },
        'damage-float': {
          'from': { transform: 'translate(-50%, 0) scale(0.6)', opacity: '0' },
          '15%': { transform: 'translate(-50%, -10px) scale(1.3)', opacity: '1' },
          'to': { transform: 'translate(-50%, -80px) scale(1)', opacity: '0' },
        },
        'flash-red': {
          '0%, 100%': { filter: 'brightness(1) saturate(1)' },
          '50%': { filter: 'brightness(1.6) saturate(1.5) drop-shadow(0 0 8px #ef4444)' },
        },
      },
    },
  },
  plugins: [],
}
