import { expect, test } from 'claude-code/testing'

const BAND = { plugin: 'waiting-buddy', component: 'AbovePrompt', props: { hasSurvey: false } } as const

test('nothing running: no band', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' } as never)
  expect((await ui.find({ type: 'Text' }))?.text).toBe('engine')
  await ui.unmount()
})
