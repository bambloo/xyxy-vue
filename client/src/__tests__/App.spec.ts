import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import LoginView from '../views/LoginView.vue'
import { validateAccount, validatePassword } from '../utils/login-validator'

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
    const wrapper = mount(LoginView)

    await wrapper.find('#account').setValue('ab')
    await wrapper.find('#password').setValue('123')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('账号需为 4-20 位字母、数字或下划线')
    expect(wrapper.text()).toContain('密码需为 8-20 位，且至少包含字母和数字')
  })
})
