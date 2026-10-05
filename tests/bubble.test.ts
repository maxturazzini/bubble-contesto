import { expect, mock, test } from 'claude-code/testing'

import { EMPTY, bubbleSvg, describeFill, levelY, percentOf } from '../hooks/bubble'

const PANE = {
  plugin: 'bubble-contesto',
  component: 'Pane',
  requestId: 'bubble-contesto',
  props: {
    title: 'Contesto',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const measure = (tokens: number, window: number) => ({
  context: { tokens, window, percent: Math.round((tokens / window) * 100) },
  rateLimits: [],
  changed: ['context' as const],
})

test('il liquido sale con la percentuale, dal fondo alla cima', async () => {
  expect(Math.round(levelY(0))).toBe(230)
  expect(Math.round(levelY(100))).toBe(38)
  expect(Math.round(levelY(50))).toBe(134)
  expect(levelY(30)).toBeGreaterThan(levelY(60))
})

test('la scala è 200k token, o la finestra se è più piccola', async () => {
  expect(percentOf(66_000, 1_000_000)).toBe(33)
  expect(percentOf(66_000, 200_000)).toBe(33)
  expect(percentOf(64_000, 128_000)).toBe(50)
  expect(percentOf(null, 1_000_000)).toBeNull()
})

test('prima della prima misura la bubble è solo contorno', async ($, on) => {
  mock.clock(on)
  for (const surface of ['desktop', 'mobile', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /Contesto vuoto/ })).toBeDefined()
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const svg = await ui.find({ type: 'Svg' })
  expect(String(svg?.props.source)).not.toContain('url(#bc-grad)')
  await ui.unmount()
})

test('con la finestra da un milione si riempie sulla scala da 200k', async ($, on) => {
  mock.clock(on)
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.measure(measure(66_000, 1_000_000))
  for (const surface of ['desktop', 'mobile', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /Contesto 66k su 200k token/ })).toBeDefined()
    await ui.unmount()
  }
  const terminal = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await terminal.find({ type: 'Text', text: /33%/ })).toBeDefined()
  await terminal.unmount()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const svg = await ui.find({ type: 'Svg' })
  expect(String(svg?.props.source)).toContain('url(#bc-grad)')
  expect(svg?.props.isInteractive).toBe(true)
  await ui.unmount()
})

test('piena: propone /compact', async ($, on) => {
  mock.clock(on)
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.measure(measure(186_000, 1_000_000))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /\/compact/ })).toBeDefined()
  await ui.unmount()
})

test('dopo /compact dice che si riparte da un riassunto', async () => {
  const f = { ...EMPTY, window: 1_000_000, previous: 150_000, changedAt: 0, isCompacted: true }
  expect(describeFill(f)[0]).toBe('Contesto compattato')
  // nei primi due secondi il liquido scende, dopo resta solo il contorno
  expect(bubbleSvg(f, 500)).toContain('animateTransform attributeName="transform" type="translate"')
  expect(bubbleSvg(f, 5_000)).not.toContain('url(#bc-grad)')
})

test('il disegno resta sotto il limite di Svg', async () => {
  for (const tokens of [null, 0, 84_000, 186_000, 400_000]) {
    const source = bubbleSvg({ ...EMPTY, tokens, window: 1_000_000, previous: 10_000, changedAt: 0 }, 100)
    expect(source.length).toBeLessThan(131072)
  }
})
