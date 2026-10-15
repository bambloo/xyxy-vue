import { describe, expect, it } from 'vitest'
import { format_user_location, parse_user_location } from '../../../common/entity/user'
import { getAllCountries } from 'localized-countries-states'
import { areaList } from '@vant/area-data'
import { mount } from '@vue/test-utils'
import LocationPicker from '../components/LocationPicker.vue'
import { i18n } from '../i18n'

describe('user location', () => {
  it('formats selected location levels in hierarchy order', () => {
    expect(
      format_user_location({
        countryCode: 'CN',
        country: '中国',
        region: '广东',
        city: '深圳',
        custom: '南山区',
      }),
    ).toBe('中国 · 广东 · 深圳 · 南山区')
  })

  it('omits blank location levels', () => {
    expect(
      format_user_location({
        countryCode: '',
        country: '',
        region: '',
        city: '',
        custom: '自定义地点',
      }),
    ).toBe('自定义地点')
  })

  it('normalizes valid location input', () => {
    expect(
      parse_user_location({
        countryCode: 'CN',
        country: ' 中国 ',
        region: '广东',
        city: '深圳',
        custom: '',
      }),
    ).toEqual({
      countryCode: 'CN',
      country: '中国',
      region: '广东',
      city: '深圳',
      custom: '',
    })
  })

  it('rejects inconsistent or oversized location values', () => {
    expect(
      parse_user_location({
        countryCode: '',
        country: '',
        region: '广东',
        city: '',
        custom: '',
      }),
    ).toBeNull()
    expect(
      parse_user_location({
        countryCode: 'CN',
        country: '中国',
        region: '广东',
        city: '深圳',
        custom: 'x'.repeat(121),
      }),
    ).toBeNull()
  })

  it('provides Chinese country names and defaults the picker to China', () => {
    const countries = getAllCountries('zh-CN')
    expect(countries.length).toBeGreaterThan(200)
    expect(countries.every((country) => /\p{Script=Han}/u.test(country.name))).toBe(true)

    const wrapper = mount(LocationPicker, { global: { plugins: [i18n] } })
    expect(wrapper.find('select').element.value).toBe('CN')
    wrapper.unmount()
  })

  it('provides Chinese province and city choices for China', async () => {
    const wrapper = mount(LocationPicker, { global: { plugins: [i18n] } })
    const provinceCode = Object.entries(areaList.province_list).find(
      ([, name]) => name === '广东省',
    )?.[0]
    expect(provinceCode).toBeTruthy()

    await wrapper.findAll('select')[1]!.setValue('广东省')
    const cityOptions = wrapper.findAll('datalist option').map((option) => option.attributes('value'))
    expect(cityOptions).toContain('深圳市')
    expect(cityOptions.every((name) => name && /\p{Script=Han}/u.test(name))).toBe(true)
    wrapper.unmount()
  })
})
