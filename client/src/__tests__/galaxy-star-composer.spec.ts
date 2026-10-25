import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BamblooStatusCode } from '../../../common/status'
import {
  GALAXY_STAR_COMPOSE_EVENT,
  GALAXY_STAR_COMPOSER_STATE_EVENT,
  GALAXY_STAR_NAVIGATE_EVENT,
} from '../events/galaxy-star'
import {
  DIALOG_STACK_CLOSE_DIALOG_EVENT,
  DIALOG_STACK_CLOSE_REQUEST_EVENT,
} from '../events/dialog-stack'
import { TIME_FORTUNE_DIALOG_STATE_EVENT } from '../events/time-fortune'
import { post } from '../scripts/request'
import GalaxyStarComposerDialog from '../components/dialogs/GalaxyStarComposerDialog.vue'

vi.mock('../scripts/request', () => ({
  post: vi.fn(),
}))

describe('paired galaxy star tab', () => {
  let wrapper: ReturnType<typeof mount<typeof GalaxyStarComposerDialog>> | undefined

  beforeEach(() => {
    vi.mocked(post).mockReset()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  async function openPairedComposer(status: {
    canSend: boolean
    todayStarColor?: string
    todayStarId?: string
  }) {
    vi.mocked(post).mockResolvedValue({
      code: BamblooStatusCode.Success,
      data: status,
    })
    wrapper = mount(GalaxyStarComposerDialog)
    window.dispatchEvent(new CustomEvent(TIME_FORTUNE_DIALOG_STATE_EVENT, { detail: true }))
    window.dispatchEvent(
      new CustomEvent(GALAXY_STAR_COMPOSE_EVENT, {
        detail: { pairedWithFortune: true },
      }),
    )
    await flushPromises()
    return wrapper
  }

  it('shows the send-star tab when a star can still be sent', async () => {
    await openPairedComposer({ canSend: true })
    const tab = document.body.querySelector('.dialog-edge-tab-star')

    expect(tab?.textContent).toContain('寄出星星')
    expect(tab?.querySelector('ion-icon')?.getAttribute('name')).toBe('star-outline')
  })

  it('shows the sent star color and navigates to the sent star', async () => {
    const navigate = vi.fn()
    window.addEventListener(GALAXY_STAR_NAVIGATE_EVENT, navigate)
    await openPairedComposer({
      canSend: false,
      todayStarColor: '#a7e8ff',
      todayStarId: 'sent-star-id',
    })
    const tab = document.body.querySelector('.dialog-edge-tab-star')

    expect(tab?.textContent).toContain('定位星星')
    expect(tab?.querySelector('ion-icon')?.getAttribute('name')).toBe('star')
    expect(tab?.getAttribute('style')).toContain('--sent-star-color: #a7e8ff')

    tab?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(navigate).toHaveBeenCalledOnce()
    expect((navigate.mock.calls[0] as [CustomEvent<string>])[0].detail).toBe('sent-star-id')
    window.removeEventListener(GALAXY_STAR_NAVIGATE_EVENT, navigate)
  })

  it('announces the composer again when reopening it from the fortune tab', async () => {
    const composerStates: boolean[] = []
    const recordComposerState = (event: Event) => {
      composerStates.push((event as CustomEvent<boolean>).detail)
    }
    window.addEventListener(GALAXY_STAR_COMPOSER_STATE_EVENT, recordComposerState)
    await openPairedComposer({ canSend: true })

    window.dispatchEvent(
      new CustomEvent(DIALOG_STACK_CLOSE_DIALOG_EVENT, { detail: 'composer' }),
    )
    await flushPromises()
    expect(document.body.querySelector('.dialog-edge-tab-star')).not.toBeNull()

    document.body.querySelector<HTMLButtonElement>('.dialog-edge-tab-star')?.click()
    expect(composerStates).toEqual([true, false, true])

    window.removeEventListener(GALAXY_STAR_COMPOSER_STATE_EVENT, recordComposerState)
  })

  it('leaves outside clicks for the fortune overlay to handle while its view is active', async () => {
    await openPairedComposer({ canSend: true })
    const closeRequest = vi.fn()
    window.addEventListener(DIALOG_STACK_CLOSE_REQUEST_EVENT, closeRequest)

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))

    expect(closeRequest).not.toHaveBeenCalled()
    window.removeEventListener(DIALOG_STACK_CLOSE_REQUEST_EVENT, closeRequest)
  })
})
