<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { normalize_user_hobbies, parse_user_hobbies } from '../../../common/entity/user'

const props = defineProps<{
  modelValue?: string
  disabled?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = useI18n()
const commonHobbies = [
  'reading',
  'travel',
  'music',
  'movies',
  'sports',
  'cooking',
  'photography',
  'gardening',
  'games',
  'painting',
  'yoga',
  'hiking',
  'dance',
  'calligraphy',
  'crafts',
  'pets',
] as const

const selectedHobbies = ref<string[]>([])
const customHobbies = ref('')
const lastEmittedValue = ref<string>()

function syncFromModel(value: string) {
  const hobbies = parse_user_hobbies(value || '')
  selectedHobbies.value = hobbies.filter((hobby) =>
    commonHobbies.some((key) => t(`profile.hobbyOptions.${key}`) === hobby),
  )
  customHobbies.value = hobbies
    .filter((hobby) => !selectedHobbies.value.includes(hobby))
    .join(' ')
}

watch(
  () => props.modelValue ?? '',
  (value) => {
    if (value === lastEmittedValue.value) {
      lastEmittedValue.value = undefined
      return
    }
    syncFromModel(value)
  },
  { immediate: true },
)

function emitHobbies(selected: string[], custom: string) {
  const value = normalize_user_hobbies([...selected, ...parse_user_hobbies(custom)].join(' '))
  lastEmittedValue.value = value
  emit('update:modelValue', value)
}

const options = computed(() =>
  commonHobbies.map((key) => ({ key, label: t(`profile.hobbyOptions.${key}`) })),
)

function toggleHobby(hobby: string) {
  if (props.disabled) return
  const next = selectedHobbies.value.includes(hobby)
    ? selectedHobbies.value.filter((item) => item !== hobby)
    : [...selectedHobbies.value, hobby]
  selectedHobbies.value = next
  emitHobbies(next, customHobbies.value)
}

function updateCustomHobbies(value: string) {
  customHobbies.value = value
  emitHobbies(selectedHobbies.value, value)
}
</script>

<template>
  <div class="hobbies-picker">
    <div class="hobby-options" role="group" :aria-label="t('profile.hobbies')">
      <button
        v-for="option in options"
        :key="option.key"
        class="hobby-option"
        :class="{ selected: selectedHobbies.includes(option.label) }"
        type="button"
        :aria-pressed="selectedHobbies.includes(option.label)"
        :disabled="disabled"
        @click="toggleHobby(option.label)"
      >
        {{ option.label }}
      </button>
    </div>
    <input
      :value="customHobbies"
      type="text"
      :maxlength="500"
      :disabled="disabled"
      :placeholder="t('profile.customHobbiesPlaceholder')"
      @input="updateCustomHobbies(($event.target as HTMLInputElement).value)"
    />
  </div>
</template>

<style scoped>
.hobbies-picker {
  display: grid;
  gap: 0.65rem;
}

.hobby-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.hobby-option {
  border: 1px solid var(--space-line);
  border-radius: 999px;
  padding: 0.4rem 0.75rem;
  background: rgba(13, 38, 67, .72);
  color: var(--space-text);
  font: inherit;
  cursor: pointer;
}

.hobby-option.selected {
  border-color: var(--space-gold);
  background: rgba(233, 180, 94, .18);
  color: var(--space-gold);
}

.hobby-option:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--space-line);
  border-radius: 10px;
  padding: 0.8rem 0.85rem;
  background: rgba(13, 38, 67, .72);
  color: var(--space-text);
  font: inherit;
}
</style>
