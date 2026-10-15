import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { normalize_user_hobbies, parse_user_hobbies } from '../../../common/entity/user'
import HobbiesPicker from '../components/HobbiesPicker.vue'
import { i18n } from '../i18n'

describe('user hobbies', () => {
  it('splits on spaces and punctuation and removes duplicates', () => {
    expect(parse_user_hobbies('阅读, 旅行；音乐、旅行')).toEqual(['阅读', '旅行', '音乐'])
    expect(normalize_user_hobbies('阅读 旅行. 音乐')).toBe('阅读、旅行、音乐')
  })

  it('supports selecting common interests and entering custom interests', async () => {
    const wrapper = mount(HobbiesPicker, {
      props: { modelValue: '' },
      global: { plugins: [i18n] },
    })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBe('阅读')

    await wrapper.get('input').setValue('烘焙，露营')
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBe('阅读、烘焙、露营')
    wrapper.unmount()
  })
})
