// waiting-buddy: while Claude has background work running (a backgrounded Bash command or agent), a little woodcutter
// chops trees in a band above the prompt: the tree comes down a branch at a time, a log goes on the pile, the tree
// grows back. Under him, what's running and for how long. When a task finishes he cheers for a few seconds.
import { atom, read, update } from 'claude-code'
import type { Register, EngineInterface } from 'claude-code'

import type { WoodcutterTask, WoodcutterDone } from '../types'

const tasks = atom({ plugin: 'waiting-buddy', key: 'tasks' } as const, [] as WoodcutterTask[])
const frame = atom({ plugin: 'waiting-buddy', key: 'frame' } as const, 0)
const done = atom({ plugin: 'waiting-buddy', key: 'done' } as const, null as WoodcutterDone | null)
const now = atom({ plugin: 'waiting-buddy', key: 'now' } as const, 0)
const scene = atom({ plugin: 'waiting-buddy', key: 'scene' } as const, 'disc' as 'disc' | 'wood')

const TICK = 250 // ms a frame
const CHEER = 4000 // ms the finish cheer stays up

// The scene, three rows: tree (4 wide), chips (2), woodcutter (4), pile.
const TREE = [
  [' /\\ ', '/__\\', ' || '], // whole
  ['    ', ' /\\ ', ' || '], // a branch off
  ['    ', '    ', ' || '], // the trunk
  ['    ', '    ', ' -- '] // the stump: a log goes on the pile, and it grows back
]
const SWING = [
  ['  o/', ' /| ', ' / \\'], // axe up
  ['  o/', ' /| ', ' / \\'],
  [' _o ', '  |\\', ' / \\'], // and down
  [' _o ', '  |\\', ' / \\']
]
const CHIPS = ['  ', '  ', ' *', '* ']
const CHEERING = [' \\o/', '  | ', ' / \\']

// Disc golf: a throw every 16 frames. Aim, release, the disc arcs down the fairway and into the chains, or not.
const LANE = 12
const P_AIM = [' o  ', '/|- ', '/ \\ ']
const P_THROW = ['\\o  ', ' |\\ ', '/ \\ ']
const P_CHEER = ['\\o/ ', ' |  ', '/ \\ ']
const BASKET = ['\\|/', '[_]', ' | ']
const RATTLE = ['\\*/', '[o]', ' | ']
// The disc's row along the fairway: up, across, down into the basket.
const ARC = [1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1]

function discScene (f: number, cheering: boolean) {
  const rows = ['', '', '']
  const t = f % 16; const throwNo = Math.floor(f / 16)
  const ace = throwNo % 3 !== 1 // two in three go in
  const aces = Math.floor(throwNo / 3) * 2 + Math.min(throwNo % 3, 1) + (throwNo % 3 === 2 ? 1 : 0)
  const man = cheering || (t === 15 && ace) ? P_CHEER : t < 3 ? P_AIM : P_THROW
  const lane = [' '.repeat(LANE), ' '.repeat(LANE), '.'.repeat(LANE)]
  let basket = BASKET
  if (!cheering && t >= 3 && t < 15) { const pos = t - 3; const r = ARC[pos]!; lane[r] = lane[r]!.slice(0, pos) + '=' + lane[r]!.slice(pos + 1) }
  if (!cheering && t === 15) { if (ace) basket = RATTLE; else lane[2] = lane[2]!.slice(0, LANE - 1) + '=' }
  for (let r = 0; r < 3; r++) rows[r] = man[r]! + lane[r]! + basket[r]!
  return { rows, aces }
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  return m ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`
}
const short = (t: string, n = 48) => (t.length > n ? t.slice(0, n - 1) + '…' : t)

// The animation runs only while there's something to show.
let ticker: { cancel: () => void } | null = null

function start ($: EngineInterface) {
  if (ticker) return
  ticker = $.clock.every(TICK, () => tick($))
}

async function tick ($: EngineInterface) {
  const t = await $.clock.now()
  await update($, now, () => t)
  await update($, frame, f => f + 1)
  const running = await read($, tasks)
  const cheer = await read($, done)
  if (!running.length && (!cheer || t - cheer.at > CHEER)) {
    if (cheer) await update($, done, () => null)
    ticker?.cancel()
    ticker = null
  }
}

async function add ($: EngineInterface, task: WoodcutterTask) {
  await update($, tasks, list => [...list.filter(x => x.id !== task.id), task])
  start($)
}

async function finish ($: EngineInterface, id: string, cheer: boolean) {
  const list = await read($, tasks)
  const task = list.find(x => x.id === id)
  if (!task) return
  await update($, tasks, l => l.filter(x => x.id !== id))
  if (cheer) {
    const t = await $.clock.now()
    await update($, done, () => ({ label: task.label, seconds: Math.round((t - task.startedAt) / 1000), at: t }))
    start($)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'scene', description: 'Pick the waiting scene: disc (disc golf) or wood (woodcutter)' })
    return next(e)
  })

  on('command.run', { command: 'scene' }, async ($, e) => {
    const want = /wood/i.test(String((e as { args?: unknown }).args ?? '')) ? 'wood' : 'disc'
    await update($, scene, () => want)
    return { text: want === 'disc' ? 'Waiting scene: disc golf.' : 'Waiting scene: the woodcutter.' }
  })

  // A backgrounded Bash command or agent: on the board.
  on('tool.call', async ($, e, next) => {
    const r = await next(e)
    try {
      const input = e as unknown as Record<string, unknown> // a tool call's input fields sit on the event itself
      const out = ('result' in r ? r.result : undefined) as Record<string, unknown> | undefined
      if (input.run_in_background && out) {
        const id = String(out.backgroundTaskId ?? out.agentId ?? '')
        const what = String(input.description ?? input.command ?? input.prompt ?? e.tool)
        if (id) await add($, { id, label: short(what), startedAt: await $.clock.now() })
      }
      if (String(e.tool) === 'TaskStop' && input.task_id) await finish($, String(input.task_id), false)
    } catch {}
    return r
  })

  // Its notification coming in: off the board, with a cheer.
  on('prompt.submit', async ($, e, next) => {
    try {
      if (e.origin?.kind === 'task-notification') {
        const id = /<task-id>([^<]+)<\/task-id>/.exec(e.text)?.[1]
        if (id) await finish($, id, !/<status>(failed|stopped|killed)/.test(e.text))
      }
    } catch {}
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const running = await read($, tasks)
    const cheer = await read($, done)
    if (!running.length && !cheer) return next(e)
    start($) // after a reload the timer is gone but the tasks aren't: start it again from here
    const f = await read($, frame)
    const t = (await read($, now)) || (await $.clock.now())
    const { Box, Text } = $.ui.resolve(e)

    const which = await read($, scene)
    const cheering = !!cheer && !running.length
    if (which === 'disc') {
      const d = discScene(f, cheering)
      const firstD = running[0]
      const lineD = running.length
        ? `${running.length > 1 ? `${running.length} running · ` : ''}${firstD!.label} · ${fmt(t - firstD!.startedAt)} · aces ${d.aces}`
        : `✓ ${cheer!.label} · done in ${fmt(cheer!.seconds * 1000)}`
      return (
        <Box flexDirection="column">
          {d.rows.map((row, i) => <Text key={`d${i}`} color={i === 2 ? 'green' : undefined}>{row}</Text>)}
          <Text dimColor={!!running.length} color={running.length ? undefined : 'green'}>{lineD}</Text>
        </Box>
      )
    }

    const swing = Math.floor(f / 4)
    const stage = Math.floor(swing / 3) % TREE.length
    const logs = Math.floor(swing / (3 * TREE.length)) % 9
    const tree = (cheer && !running.length ? TREE[0] : TREE[stage])!
    const man = (cheer && !running.length ? CHEERING : SWING[f % 4])!
    const chips = cheer && !running.length ? '  ' : CHIPS[f % 4]
    const pile = logs ? ' ' + '='.repeat(logs) : ''

    const first = running[0]!
    const line = running.length
      ? `${running.length > 1 ? `${running.length} running · ` : ''}${first.label} · ${fmt(t - first.startedAt)}`
      : `✓ ${cheer!.label} · done in ${fmt(cheer!.seconds * 1000)}`

    return (
      <Box flexDirection="column">
        {[0, 1, 2].map(row => (
          <Text key={`r${row}`}>
            <Text color="green">{tree[row]}</Text>
            <Text color="yellow">{row === 1 ? chips : '  '}</Text>
            <Text>{man[row]}</Text>
            <Text color="yellow">{row === 2 ? pile : ''}</Text>
          </Text>
        ))}
        <Text dimColor={!!running.length} color={running.length ? undefined : 'green'}>{line}</Text>
      </Box>
    )
  })
}
