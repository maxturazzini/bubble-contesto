import type { Fill } from '../types'

export const EMPTY: Fill = { tokens: null, window: null, previous: null, changedAt: null, isCompacted: false }

// La bubble è piena a 200k token, o prima se la finestra del modello è più piccola.
// Con le finestre da un milione la qualità cala molto prima di riempirle: una scala sulla
// finestra intera lascerebbe la bubble quasi vuota proprio quando conviene compattare.
export const FULL_AT = 200_000

// quanto resta la salita animata dopo un cambio di livello: un ridisegno successivo non la ripete
const RISE_MS = 2_000

// la bubble v2 del brand AI, MAX, in posa relax
const ELLIPSE =
  'M 80 134 C 80 80.97, 142.68 38, 220 38 C 297.32 38, 360 80.97, 360 134 C 360 187.03, 297.32 230, 220 230 C 142.68 230, 80 187.03, 80 134 Z'
const TAIL = 'M 146 199 L 192 210 L 130 252 Z'
const SHOE =
  'M -13 -4 C -13 -13, 0 -15, 9 -11 C 20 -7, 28 -2, 28 5 C 28 10, 24 12, 18 12 L -8 12 C -12 12, -14 9, -14 5 Z'
const CY = 134
const RY = 96
const BELOW = 300

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export const scaleOf = (window: number | null): number => Math.min(window ?? FULL_AT, FULL_AT)

export const percentOf = (tokens: number | null, window: number | null): number | null =>
  tokens === null ? null : Math.round((tokens / scaleOf(window)) * 100)

// la quota del liquido per una percentuale: conta l'area dell'ellisse, non l'altezza
export const levelY = (percent: number): number => {
  const target = clamp(percent, 0, 100) / 100
  let lo = -1
  let hi = 1
  for (let i = 0; i < 40; i++) {
    const u = (lo + hi) / 2
    const area = 0.5 + (u * Math.sqrt(1 - u * u) + Math.asin(u)) / Math.PI
    if (area < target) lo = u
    else hi = u
  }
  return CY - ((lo + hi) / 2) * RY
}

// superficie del liquido attorno a y = 0; periodica in 2π, così il loop si chiude
const wave = (amp: number, phase: number): string => {
  let d = ''
  for (let x = 60; x <= 380; x += 10) {
    const y = amp * Math.sin(x * 0.045 + phase) + 0.5 * amp * Math.sin(x * 0.11 - 2 * phase)
    d += `${d ? ' L' : 'M'} ${x} ${y.toFixed(2)}`
  }
  return `${d} L 380 ${BELOW} L 60 ${BELOW} Z`
}

const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))

export const describeFill = (f: Fill): string[] => {
  if (f.tokens === null) {
    return f.isCompacted
      ? ['Contesto compattato', 'Si riparte da un riassunto della sessione.']
      : ['Contesto vuoto', 'Si riempie man mano che la sessione accumula contesto.']
  }
  const p = percentOf(f.tokens, f.window) ?? 0
  const hint =
    p >= 100
      ? 'Traboccata. Adesso /compact, oppure ricomincia da un riassunto.'
      : p >= 90
        ? 'Piena. Adesso /compact, oppure ricomincia da un riassunto.'
        : p >= 75
          ? 'Quasi piena. Se cambi argomento, meglio una sessione nuova.'
          : p >= 50
            ? "Si riempie. Più è piena, più l'agente fatica a tenere a mente l'inizio."
            : "C'è spazio."
  return [`Contesto ${k(f.tokens)} su ${k(scaleOf(f.window))} token`, hint]
}

export const bar = (f: Fill, width: number): string => {
  const p = percentOf(f.tokens, f.window)
  if (p === null) return `(${' '.repeat(width)})`
  const n = Math.round((clamp(p, 0, 100) / 100) * width)
  return `(${'█'.repeat(n)}${'░'.repeat(width - n)}) ${p}%`
}

export const bubbleSvg = (f: Fill, now: number): string => {
  const p = percentOf(f.tokens, f.window)
  const shown = p ?? 0
  const amp = shown >= 90 ? 9 : shown >= 70 ? 6 : 3.5
  const dur = shown >= 90 ? 1.6 : shown >= 70 ? 2.6 : 4
  const frames = Array.from({ length: 9 }, (_, i) => wave(amp, (i / 8) * 2 * Math.PI))
  const to = p === null ? BELOW : levelY(p)
  const before = percentOf(f.previous, f.window)
  const from = before === null ? BELOW : levelY(before)
  const isRising = f.changedAt !== null && now - f.changedAt < RISE_MS && from !== to
  const rise = isRising
    ? `<animateTransform attributeName="transform" type="translate" from="0 ${from.toFixed(1)}" to="0 ${to.toFixed(1)}" dur="1.4s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.25 0.9 0.3 1"/>`
    : ''
  const liquid =
    p === null && !isRising
      ? ''
      : `<g clip-path="url(#bc-clip)"><g transform="translate(0 ${to.toFixed(1)})">${rise}<path fill="url(#bc-grad)" d="${frames[0]}"><animate attributeName="d" dur="${dur}s" repeatCount="indefinite" values="${frames.join(';')}"/></path></g></g>`
  // sopra il 90% la bubble guarda in alto, verso il pelo del liquido
  const eyesY = shown >= 90 ? 114 : 124

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 0 460 330" width="460" height="330">
<defs>
<linearGradient id="bc-grad" gradientUnits="userSpaceOnUse" x1="80" y1="252" x2="360" y2="38"><stop offset="0" stop-color="#FF91C9"/><stop offset="1" stop-color="#35C2FF"/></linearGradient>
<radialGradient id="bc-shadow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#000" stop-opacity="0.22"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></radialGradient>
<clipPath id="bc-clip"><path d="${ELLIPSE}"/><path d="${TAIL}"/></clipPath>
<path id="bc-shoe" d="${SHOE}"/>
</defs>
<rect x="-10" y="0" width="460" height="330" rx="18" fill="#FAF7F2"/>
<ellipse cx="220" cy="312" rx="110" ry="11" fill="url(#bc-shadow)"/>
<g stroke="#1a1a1a" fill="none" stroke-linecap="round">
<path d="M 190 222 C 190 250, 186 270, 186 298" stroke-width="20"/>
<path d="M 250 222 C 250 250, 254 270, 254 298" stroke-width="20"/>
<path d="M 112 176 C 84 190, 68 208, 64 236" stroke-width="18"/>
<path d="M 328 176 C 356 190, 372 208, 376 236" stroke-width="18"/>
</g>
<g fill="#1a1a1a">
<use href="#bc-shoe" transform="translate(186,298) scale(-1,1)"/>
<use href="#bc-shoe" transform="translate(254,298)"/>
<circle cx="64" cy="247" r="15"/>
<circle cx="376" cy="247" r="15"/>
</g>
<g stroke="#111" stroke-width="9" stroke-linejoin="round" fill="none"><path d="${ELLIPSE}"/><path d="${TAIL}"/></g>
<g fill="#FAF7F2"><path d="${ELLIPSE}"/><path d="${TAIL}"/></g>
${liquid}
<g transform="translate(220 ${eyesY})"><g>
<animateTransform attributeName="transform" type="scale" values="1 1;1 1;1 0.08;1 1" keyTimes="0;0.93;0.965;1" dur="4.7s" repeatCount="indefinite"/>
<ellipse cx="-40" cy="0" rx="14.7" ry="32.4" fill="#fff" stroke="#111" stroke-width="3"/>
<ellipse cx="40" cy="0" rx="14.7" ry="32.4" fill="#fff" stroke="#111" stroke-width="3"/>
</g></g>
</svg>`
}
