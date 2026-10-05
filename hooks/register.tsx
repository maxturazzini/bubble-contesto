import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionContextUsage } from 'claude-code'

import type { Fill } from '../types'
import { EMPTY, bar, bubbleSvg, describeFill } from './bubble'

const PANE = 'bubble-contesto'
// in $.store, quindi vale fra una sessione e l'altra: true se la persona ha spento la bubble
const HIDDEN = 'hidden'
const fill = atom({ plugin: 'bubble-contesto', key: 'fill' } as const, EMPTY)

const measured = (f: Fill, context: SessionContextUsage, now: number): Fill => {
  const tokens =
    context.tokens ?? (context.percent === undefined ? null : Math.round((context.percent / 100) * context.window))
  if (tokens === f.tokens) return f
  return { tokens, window: context.window, previous: f.tokens, changedAt: now, isCompacted: false }
}

const open = ($: EngineInterface) => $.ui.open({ id: PANE, title: 'Contesto' })

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'bubble',
      description: 'Accende e spegne la bubble che si riempie con il contesto della sessione',
    })
    const usage = await $.session.usage()
    const now = await $.clock.now()
    await update($, fill, f => measured(f, usage.context, now))
    if ((await $.store.get(HIDDEN)) !== true) void open($)

    return next(e)
  })

  on('command.run', { command: 'bubble' }, async $ => {
    // dove nessuna superficie disegna (l'estensione VS Code, oggi) la bubble diventa testo
    if ((await $.session.surfaces()).length === 0) {
      const f = await read($, fill)
      return { text: [bar(f, 20), ...describeFill(f)].join('\n') }
    }

    if ((await $.ui.panes()).some(pane => pane.id === PANE)) {
      await $.ui.close({ id: PANE })
      await $.store.set(HIDDEN, true)
      return { text: 'Bubble spenta. /bubble la riaccende.' }
    }

    await $.store.set(HIDDEN, false)
    const opened = await open($)
    return { text: opened.isPlaced ? 'Bubble accesa.' : `Bubble accesa, in attesa: ${opened.reason}` }
  })

  // chiusa con la ✕ o con ctrl+x x: resta spenta anche nelle sessioni dopo
  on('ui.close', { id: PANE }, async ($, e, next) => {
    const result = await next(e)
    if (e.origin.kind === 'person') await $.store.set(HIDDEN, true)

    return result
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('context')) {
      const now = await $.clock.now()
      await update($, fill, f => measured(f, e.context, now))
    }

    return next(e)
  })

  // dopo /compact il motore non ha una misura fino alla risposta dopo: la bubble si svuota
  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    const now = await $.clock.now()
    await update($, fill, f => ({ tokens: null, window: f.window, previous: f.tokens, changedAt: now, isCompacted: true }))

    return result
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const f = await read($, fill)
    const [headline, hint] = describeFill(f)

    if (e.surface === 'terminal') {
      const { Box, Text } = $.ui.resolve(e)
      const width = Math.max(10, Math.min(30, e.props.bodyColumns - 8))

      return (
        <Box flexDirection="column">
          <Text key="bar">{bar(f, width)}</Text>
          <Text key="headline">{headline}</Text>
          <Text key="hint" dimColor>
            {hint}
          </Text>
        </Box>
      )
    }

    const { Box, Svg, Text } = $.ui.resolve(e)
    const now = await $.clock.now()

    return (
      <Box flexDirection="column">
        <Svg key="bubble" source={bubbleSvg(f, now)} alt={headline ?? 'Bubble del contesto'} width={240} isInteractive />
        <Text key="headline">{headline}</Text>
        <Text key="hint" dimColor>
          {hint}
        </Text>
      </Box>
    )
  })
}
