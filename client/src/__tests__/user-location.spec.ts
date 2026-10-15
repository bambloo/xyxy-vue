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
    const citySelect = wrapper.findAll('select')[2]!
    const cityOptions = citySelect.findAll('option').map((option) => option.element.value)
    expect(cityOptions).toContain('深圳市')
    expect(cityOptions.filter(Boolean).every((name) => /\p{Script=Han}/u.test(name))).toBe(true)
    await citySelect.setValue('深圳市')
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toMatchObject({
      countryCode: 'CN',
      region: '广东省',
      city: '深圳市',
    })
    wrapper.unmount()
  })

  it('has consistent province and city administrative codes including Langfang', () => {
    const provinces = Object.entries(areaList.province_list)
    const cities = Object.entries(areaList.city_list)
    expect(provinces).toHaveLength(34)
    expect(provinces.every(([provinceCode]) =>
      cities.some(([cityCode]) => cityCode.startsWith(provinceCode.slice(0, 2))),
    )).toBe(true)
    expect(
      cities.every(([cityCode]) =>
        provinces.some(([provinceCode]) => cityCode.startsWith(provinceCode.slice(0, 2))),
      ),
    ).toBe(true)

    const hebeiCode = provinces.find(([, name]) => name === '河北省')?.[0]
    expect(hebeiCode).toBe('130000')
    expect(
      cities.find(([code, name]) => code === '131000' && name === '廊坊市')?.[1],
    ).toBe('廊坊市')
    expect(cities.some(([code]) => code.startsWith(hebeiCode!.slice(0, 2)) && code === '131000')).toBe(
      true,
    )
  })

  it('keeps city entry as text for countries without a city dataset', async () => {
    const wrapper = mount(LocationPicker, { global: { plugins: [i18n] } })
    await wrapper.findAll('select')[0]!.setValue('US')

    const cityField = wrapper.findAll('label')[2]!.find('input')
    expect(cityField.exists()).toBe(true)
    await cityField.setValue('New York')
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toMatchObject({
      countryCode: 'US',
      city: 'New York',
    })
    wrapper.unmount()
  })
})
