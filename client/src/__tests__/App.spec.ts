import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import App from '../views/LoginView.vue/index.js'

describe('App', () => {
  it('mounts renders properly', () => {
    const wrapper = mount(App)
    expect(wrapper.text()).toContain('You did it!')
  })
})
