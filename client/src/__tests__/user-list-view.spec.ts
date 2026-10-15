import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import UserListView from '../views/user/users/UserListView.vue'
import { i18n } from '../i18n'
import { post } from '../scripts/request'

vi.mock('../scripts/request', () => ({
  post: vi.fn(),
}))

describe('user list Tag registration', () => {
  beforeEach(() => {
    vi.mocked(post).mockReset()
  })

  it('registers the Tag without displaying or editing returned profile information', async () => {
    vi.mocked(post).mockResolvedValue({
      data: {
        tag: 'tag-123',
        account: 'user-account',
        name: 'User Name',
        city: 'Langfang',
        hobbies: 'reading',
      },
    } as never)

    const wrapper = mount(UserListView, {
      global: {
        plugins: [i18n],
        stubs: ['ion-icon'],
      },
    })

    await wrapper.find('#new-tag').setValue('tag-123')
    await wrapper.find('.add-tag-form').trigger('submit')
    await flushPromises()

    expect(post).toHaveBeenCalledWith(
      '/wpi/user/add-tag',
      expect.anything(),
      { tag: 'tag-123' },
    )
    expect(wrapper.text()).toContain('Tag 添加成功。')
    expect(wrapper.find('.user-table-wrap').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('user-account')
    expect(wrapper.text()).not.toContain('User Name')
    expect(wrapper.text()).not.toContain('Langfang')
    expect(wrapper.find('#new-tag').element.value).toBe('')

    wrapper.unmount()
  })

  it('keeps the pre-location user query columns', async () => {
    vi.mocked(post).mockResolvedValue({
      data: {
        tag: 'tag-456',
        account: 'user-account',
        name: 'User Name',
        phone: '123456789',
        isActive: true,
      },
    } as never)

    const wrapper = mount(UserListView, {
      global: {
        plugins: [i18n],
        stubs: ['ion-icon'],
      },
    })

    await wrapper.find('input[type="search"]:not(#new-tag)').setValue('tag-456')
    await wrapper.find('form.query-form:not(.add-tag-form)').trigger('submit')
    await flushPromises()

    expect(wrapper.findAll('.user-table-wrap th').map((header) => header.text())).toEqual([
      '用户 Tag',
      '账号',
      '姓名',
      '手机号',
      '状态',
    ])
    expect(wrapper.find('.user-table-wrap').text()).toContain('User Name')
    expect(wrapper.find('.user-table-wrap').findAll('input')).toHaveLength(0)
    expect(wrapper.find('.user-table-wrap').findAll('button')).toHaveLength(0)

    wrapper.unmount()
  })
})
