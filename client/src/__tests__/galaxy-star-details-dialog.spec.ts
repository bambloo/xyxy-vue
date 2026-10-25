import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import GalaxyStarDetailsDialog from '@/components/dialogs/GalaxyStarDetailsDialog.vue'
import { DIALOG_STACK_CLOSE_DIALOG_EVENT } from '@/events/dialog-stack'
import type { GalaxyStarView } from '../../../common/entity/galaxy-star'

const star: GalaxyStarView = {
  id: 'star-1',
  title: 'Test star',
  content: 'Star content',
  color: '#ffd27d',
  createdAt: '2026-10-26',
  likeCount: 1,
  dislikeCount: 0,
  connectionCount: 0,
  comments: [
    {
      id: 'comment-1',
      content: 'A comment',
      createdAt: '2026-10-26',
      sourceStarTitle: 'Another star',
      sourceStarColor: '#7ec8ff',
      likeCount: 0,
      dislikeCount: 0,
    },
  ],
  isOwn: true,
}

function mountDialog() {
  return mount(GalaxyStarDetailsDialog, {
    props: {
      open: true,
      star,
      blackHoleView: false,
      selectedCommentId: '',
      hasSentToday: true,
      voteLoading: false,
      voteError: '',
      commentLoading: false,
      commentError: '',
      commentText: '',
      replyingToCommentId: '',
    },
    global: {
      stubs: {
        Teleport: true,
        Transition: false,
      },
    },
  })
}

describe('galaxy star details dialog', () => {
  it('renders the star and its comments', () => {
    const wrapper = mountDialog()

    expect(wrapper.text()).toContain('Test star')
    expect(wrapper.text()).toContain('Star content')
    expect(wrapper.text()).toContain('A comment')
    expect(wrapper.find('.sent-star-comment').attributes('style')).toContain(
      '--comment-star-color: #7ec8ff',
    )
    expect(wrapper.find('.sent-star-votes .vote-like').exists()).toBe(true)
    expect(wrapper.find('.sent-star-votes .vote-dislike').exists()).toBe(true)
    expect(wrapper.find('.sent-star-comment-votes .vote-like').exists()).toBe(true)
    expect(wrapper.find('.sent-star-comment-votes .vote-dislike').exists()).toBe(true)
  })

  it('emits close, vote, and comment actions', async () => {
    const wrapper = mountDialog()

    await wrapper.find('.sent-star-dialog-overlay').trigger('click')
    window.dispatchEvent(
      new CustomEvent(DIALOG_STACK_CLOSE_DIALOG_EVENT, { detail: 'star-details' }),
    )
    await wrapper.find('.sent-star-votes button').trigger('click')
    await wrapper.find('.sent-star-main-comment-form textarea').setValue('New comment')
    await wrapper.find('.sent-star-main-comment-form').trigger('submit')

    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.emitted('vote-star')).toEqual([['like']])
    expect(wrapper.emitted('update:commentText')).toEqual([['New comment']])
    expect(wrapper.emitted('comment')).toEqual([[]])
    wrapper.unmount()
  })
})
