export type WoodcutterTask = { id: string; label: string; startedAt: number }
export type WoodcutterDone = { label: string; seconds: number; at: number }

declare module 'claude-code' {
  interface PluginState {
    'waiting-buddy': {
      tasks: WoodcutterTask[]
      frame: number
      done: WoodcutterDone | null
      now: number
      scene: 'disc' | 'wood'
    }
  }
}
