<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { areaList } from '@vant/area-data'
import {
  getAllCountries,
  getStatesOfCountry,
} from 'localized-countries-states'
import type { UserLocation } from '../../../common/entity/user'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  modelValue?: UserLocation
  legacyValue?: string
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [location: UserLocation] }>()
const { t } = useI18n()
const countryCode = ref('CN')
const region = ref('')
const city = ref('')
const custom = ref('')

const countries = getAllCountries('zh-CN')
  .map((country) => ({
    ...country,
    name: country.code === 'CN' ? '中国' : country.name,
  }))
  .sort((first, second) => first.name.localeCompare(second.name, 'zh-CN'))

const regions = computed(() => {
  if (countryCode.value === 'CN') {
    return Object.entries(areaList.province_list)
      .map(([code, name]) => ({ code, name }))
      .sort((first, second) => first.code.localeCompare(second.code))
  }

  return getStatesOfCountry(countryCode.value, 'zh-CN')
    .filter((state) => /\p{Script=Han}/u.test(state.name))
    .map((state) => ({ code: state.code, name: state.name }))
})

const selectedCountry = computed(() =>
  countries.find((country) => country.code === countryCode.value),
)

function currentLocation(): UserLocation {
  return {
    countryCode: countryCode.value,
    country: selectedCountry.value?.name ?? '',
    region: region.value,
    city: city.value,
    custom: custom.value,
  }
}

function emitLocation() {
  emit('update:modelValue', currentLocation())
}

function matchesCurrent(location: UserLocation) {
  const current = currentLocation()
  return (
    location.countryCode === current.countryCode &&
    location.country === current.country &&
    location.region === current.region &&
    location.city === current.city &&
    location.custom === current.custom
  )
}

watch(
  () => props.modelValue,
  (location) => {
    if (location && matchesCurrent(location)) return

    const initial = location ?? {
      countryCode: 'CN',
      country: '中国',
      region: '',
      city: '',
      custom: props.legacyValue?.trim() ?? '',
    }
    const nextCountryCode = countries.some((country) => country.code === initial.countryCode)
      ? initial.countryCode
      : 'CN'
    countryCode.value = nextCountryCode

    const nextRegions =
      nextCountryCode === 'CN'
        ? Object.values(areaList.province_list)
        : getStatesOfCountry(nextCountryCode, 'zh-CN')
            .filter((state) => /\p{Script=Han}/u.test(state.name))
            .map((state) => state.name)
    if (nextRegions.includes(initial.region)) {
      region.value = initial.region
      city.value = initial.city
      custom.value = initial.custom
    } else {
      region.value = ''
      city.value = ''
      custom.value =
        [initial.region, initial.city, initial.custom].filter(Boolean).join(' · ') ||
        props.legacyValue?.trim() ||
        ''
    }

    if (!location || !matchesCurrent(location)) emitLocation()
  },
  { immediate: true, deep: true },
)

function selectCountry(value: string) {
  countryCode.value = value
  region.value = ''
  city.value = ''
  custom.value = ''
  emitLocation()
}

function selectRegion(value: string) {
  region.value = value
  city.value = ''
  emitLocation()
}

function selectCity(value: string) {
  city.value = value
  emitLocation()
}

function setCustom(value: string) {
  custom.value = value
  emitLocation()
}
</script>

<template>
  <div class="location-picker">
    <label>
      <span>{{ t('location.country') }}</span>
      <select
        :value="countryCode"
        :disabled="disabled"
        @change="selectCountry(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="country in countries" :key="country.code" :value="country.code">
          {{ country.name }}
        </option>
      </select>
    </label>
    <label>
      <span>{{ t('location.region') }}</span>
      <select
        v-if="regions.length"
        :value="region"
        :disabled="disabled"
        @change="selectRegion(($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ t('location.selectRegion') }}</option>
        <option v-for="item in regions" :key="item.code" :value="item.name">{{ item.name }}</option>
      </select>
      <input
        v-else
        :value="region"
        :disabled="disabled"
        maxlength="120"
        :placeholder="t('location.selectRegion')"
        @input="selectRegion(($event.target as HTMLInputElement).value)"
      />
    </label>
    <label class="location-city">
      <span>{{ t('location.city') }}</span>
      <input
        :value="city"
        type="text"
        :disabled="disabled"
        maxlength="120"
        :placeholder="t('location.selectCity')"
        @input="selectCity(($event.target as HTMLInputElement).value)"
      />
    </label>
    <label class="location-custom">
      <span>{{ t('location.custom') }}</span>
      <input
        :value="custom"
        type="text"
        maxlength="120"
        :disabled="disabled"
        :placeholder="t('location.customPlaceholder')"
        @input="setCustom(($event.target as HTMLInputElement).value)"
      />
    </label>
  </div>
</template>

<style scoped>
.location-picker {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

label {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 7px;
  color: #c3d5e7;
  font-size: 13px;
  font-weight: 600;
}

select,
input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid rgba(166, 202, 239, .22);
  border-radius: 9px;
  padding: 10px 11px;
  background: rgba(13, 38, 67, .78);
  color: #e8f1fb;
  font: inherit;
}

select:disabled,
input:disabled {
  opacity: .58;
}

.location-custom {
  grid-column: 1 / -1;
}

.location-city {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  padding: 0 0 7px;
  border-bottom: 1px solid rgba(195, 213, 231, 0.42);
}

.location-city input {
  border: 0;
  border-radius: 0;
  padding: 8px 0;
  background: transparent;
  text-align: right;
}

.location-city input:focus {
  outline: none;
}

@media (max-width: 560px) {
  .location-picker {
    grid-template-columns: 1fr;
  }

  .location-custom {
    grid-column: auto;
  }
}
</style>
