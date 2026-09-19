import { describe, it, expect, vi } from 'vitest'

import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import { validateAccount, validatePassword } from '../utils/login-validator'
import { mongo_helper } from '../../../server/src/util/mongo-helper'
import { user_manager, DEFAULT_ADMIN_ACCOUNT } from '../../../server/src/core/manager/user'

function mountLoginView() {
  setActivePinia(createPinia())

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/login', name: 'login', component: { template: '<div />' } }],
  })

  return mount(LoginView, {
    global: {
      plugins: [router],
      stubs: ['ion-icon'],
    },
  })
}

describe('login form validation', () => {
  it('validates account format', () => {
    expect(validateAccount('ab')).toBe(
      '账号需为 4-20 位字母、数字或下划线，手机号可直接输入 11 位数字',
    )
    expect(validateAccount('13800000000')).toBe('')
    expect(validateAccount('alice_01')).toBe('')
  })

  it('validates password format', () => {
    expect(validatePassword('123')).toBe('密码需为 8-20 位，且至少包含字母和数字')
    expect(validatePassword('abc12345')).toBe('')
    expect(validatePassword('Password123')).toBe('')
  })

  it('shows format errors when submitting invalid values', async () => {
    const wrapper = mountLoginView()

    await wrapper.find('#account').setValue('ab')
    await wrapper.find('#password').setValue('123')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('账号需为 4-20 位字母、数字或下划线')
    expect(wrapper.text()).toContain('密码需为 8-20 位，且至少包含字母和数字')
  })

  it('creates default admin user when missing', async () => {
    const getSpy = vi.spyOn(mongo_helper, 'get').mockRejectedValue(new Error('not found'))
    const insertOne = vi.fn().mockResolvedValue({ insertedId: 'admin-id' })
    const ddoSpy = vi.spyOn(mongo_helper, 'ddo').mockImplementation(async (callback) => {
      return callback({
        collection: () => ({ insertOne }),
      } as never)
    })

    const manager = new user_manager()
    const admin = await manager.ensureAdmin()

    expect(admin.account).toBe(DEFAULT_ADMIN_ACCOUNT)
    expect(admin.isAdmin).toBe(true)
    expect(insertOne).toHaveBeenCalledTimes(1)

    getSpy.mockRestore()
    ddoSpy.mockRestore()
  })
})
