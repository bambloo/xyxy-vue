import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SITE_DECLARATIONS } from '../../../common/entity/site-info'
import { i18n, setLocale } from '../i18n'
import { post } from '../scripts/request'
import { useAuthStore } from '../stores/auth'
import { canAccessMenu, userMenuItems } from '../views/user/menu-config'
import SiteInfoView from '../views/user/SiteInfoView.vue'

vi.mock('../scripts/request', () => ({
  post: vi.fn(),
}))

function login(isAdmin = false) {
  setActivePinia(createPinia())
  useAuthStore().login('test-token', {
    tag: 'test-user',
    account: 'test-account',
    name: 'Test User',
    isAdmin,
  })
}

describe('website declarations and suggestions', () => {
  beforeEach(() => {
    vi.mocked(post).mockReset()
    setLocale('zh-CN')
  })

  it('lets users read declarations and submit suggestions', async () => {
    login()
    vi.mocked(post)
      .mockResolvedValueOnce({
        data: {
          declarations: SITE_DECLARATIONS.map((item) => ({
            id: item.id,
            content: `Text for ${item.id}`,
          })),
          suggestions: [],
        },
      } as never)
      .mockResolvedValueOnce({ data: {} } as never)

    const wrapper = mount(SiteInfoView, { global: { plugins: [i18n] } })
    await flushPromises()

    const pageItems = wrapper.findAll('.page-list-item').map((item) => item.text())
    expect(pageItems).toContain('中文简体切换语言›')
    expect(pageItems).toContain('反馈与建议›')
    expect(pageItems).toContain('账号管理规定›')
    expect(pageItems).toContain('在线服务协议›')
    expect(pageItems).toContain('平台管理规范›')
    expect(pageItems).toContain('第三方共享清单›')
    expect(pageItems).toContain('个人信息收集清单›')
    expect(pageItems).toContain('软件许可及用户协议›')
    const accountRules = SITE_DECLARATIONS[0]!
    await wrapper
      .findAll('.page-list-item')
      .find((item) => item.text().includes('账号管理规定'))!
      .trigger('click')
    expect(wrapper.text()).toContain(`Text for ${accountRules.id}`)

    await wrapper.get('.back-button').trigger('click')
    await wrapper
      .findAll('.page-list-item')
      .find((item) => item.text().includes('反馈与建议'))!
      .trigger('click')
    expect(wrapper.find('textarea').attributes('placeholder')).toContain('建议')
    await wrapper.find('textarea').setValue('Please add dark mode')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(post).toHaveBeenLastCalledWith(
      '/wpi/site-info/suggestion',
      expect.anything(),
      { content: 'Please add dark mode' },
    )
    expect(wrapper.text()).toContain('建议已提交')
    expect(wrapper.find('textarea').element.value).toBe('')

    wrapper.unmount()
  })

  it('renders as an independent dialog and closes without routing', async () => {
    login()
    vi.mocked(post).mockResolvedValueOnce({
      data: {
        declarations: SITE_DECLARATIONS.map((item) => ({
          id: item.id,
          content: `Text for ${item.id}`,
        })),
        suggestions: [],
      },
    } as never)
    const wrapper = mount(SiteInfoView, {
      props: { dialog: true },
      global: { plugins: [i18n] },
      attachTo: document.body,
    })
    await flushPromises()

    expect(document.body.querySelector('.site-info-overlay')).not.toBeNull()
    document.body.querySelector<HTMLButtonElement>('.site-info-dialog .dialog-close')?.click()
    expect(wrapper.emitted('close')).toHaveLength(1)

    wrapper.unmount()
  })

  it('only shows the backend management item to users with site management permission', () => {
    login()
    const menuItem = userMenuItems.find((item) => item.key === 'site-info')!
    expect(canAccessMenu(useAuthStore().currentUser, menuItem)).toBe(false)

    useAuthStore().login('admin-token', {
      tag: 'admin',
      account: 'admin',
      name: 'Admin',
      permissions: ['site.manage'],
    })
    expect(canAccessMenu(useAuthStore().currentUser, menuItem)).toBe(true)
  })

  it('lets administrators edit declarations and review suggestions', async () => {
    login(true)
    let resolveSave!: (value: Awaited<ReturnType<typeof post>>) => void
    vi.mocked(post)
      .mockResolvedValueOnce({
        data: {
          declarations: SITE_DECLARATIONS.map((item) => ({
            id: item.id,
            content: '',
          })),
          suggestions: [
            {
              id: 'suggestion-1',
              userTag: 'visitor-tag',
              content: 'Please add dark mode',
              createdAt: '2026-10-15 12:00:00',
              isRead: false,
            },
          ],
        },
      } as never)
      .mockResolvedValueOnce({ data: { id: 'suggestion-1', isRead: true } } as never)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSave = resolve
          }),
      )

    const wrapper = mount(SiteInfoView, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(wrapper.text()).toContain('账号管理规定')
    expect(wrapper.text()).toContain('软件许可及用户协议')
    expect(wrapper.find('form').exists()).toBe(false)

    await wrapper
      .findAll('.page-list-item')
      .find((item) => item.text().includes('反馈与建议'))!
      .trigger('click')
    expect(wrapper.text()).not.toContain('你的建议将提交给网站管理员')
    expect(wrapper.text()).toContain('visitor-tag')
    expect(wrapper.text()).toContain('Please add dark mode')
    await wrapper.get('.suggestion-filters button:nth-child(2)').trigger('click')
    expect(wrapper.text()).toContain('Please add dark mode')
    await wrapper.get('.suggestion-filters button:nth-child(3)').trigger('click')
    expect(wrapper.text()).toContain('此筛选下没有建议')
    await wrapper.get('.suggestion-filters button:nth-child(1)').trigger('click')
    await wrapper.get('.suggestion-card .secondary-button').trigger('click')
    await flushPromises()
    expect(post).toHaveBeenCalledWith(
      '/wpi/site-info/suggestion/read',
      expect.anything(),
      { id: 'suggestion-1' },
    )
    expect(wrapper.text()).toContain('已读')
    await wrapper.get('.back-button').trigger('click')

    const declaration = SITE_DECLARATIONS[0]!
    const declarationLabel = i18n.global.t(
      `siteInfo.declarationTitles.${declaration.titleKey}`,
    )
    await wrapper
      .findAll('.page-list-item')
      .find((item) => item.text().includes(declarationLabel))!
      .trigger('click')
    await wrapper.get(`textarea[aria-label="${declarationLabel}"]`).setValue('Updated declaration')
    const saveButton = wrapper
      .findAll('button')
      .find((button) => button.text() === i18n.global.t('siteInfo.saveDeclaration'))
    await saveButton!.trigger('click')
    const textarea = wrapper.get(`textarea[aria-label="${declarationLabel}"]`)
    expect(textarea.element.disabled).toBe(false)
    expect(textarea.element.readOnly).toBe(true)
    expect(wrapper.find('.detail-panel').exists()).toBe(true)

    resolveSave({
      data: {
        id: declaration.id,
        content: 'Updated declaration',
        updatedAt: '2026-10-15 12:30:00',
      },
    } as never)
    await flushPromises()

    expect(vi.mocked(post)).toHaveBeenCalledTimes(3)
    expect(vi.mocked(post).mock.calls[2]?.[0]).toBe('/wpi/site-info/declaration')
    expect(vi.mocked(post).mock.calls[2]?.[2]).toEqual({
      id: declaration.id,
      content: 'Updated declaration',
    })
    expect(wrapper.text()).toContain('声明已保存')

    wrapper.unmount()
  })
})
