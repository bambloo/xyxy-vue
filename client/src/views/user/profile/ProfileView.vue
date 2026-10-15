<script setup lang="ts">
import { defineAsyncComponent, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore, type AuthUser } from '../../../stores/auth'
import { post } from '../../../scripts/request'
import { MAX_USER_HOBBIES_LENGTH, type UserLocation } from '../../../../../common/entity/user'
import {
  is_at_least_five_years_old,
  is_valid_email,
  is_valid_name,
  is_valid_phone,
} from '../../../utils/user-validator'

const statusMessage = ref('')
const loading = ref(false)
const { t } = useI18n()
const auth = useAuthStore()
const LocationPicker = defineAsyncComponent(() => import('@/components/LocationPicker.vue'))
const HobbiesPicker = defineAsyncComponent(() => import('@/components/HobbiesPicker.vue'))

const emptyLocation = (): UserLocation => ({
  countryCode: 'CN',
  country: '中国',
  region: '',
  city: '',
  custom: '',
})
const user = reactive({
  account: '',
  name: '',
  phone: '',
  email: '',
  birthday: '',
  hobbies: '',
  location: emptyLocation(),
})

watch(() => auth.currentUser, (currentUser) => {
  if (!currentUser) return
  user.account = currentUser.account
  user.name = currentUser.name
  user.phone = currentUser.phone || ''
  user.email = currentUser.email || ''
  user.birthday = currentUser.birthday || ''
  user.hobbies = currentUser.hobbies || ''
  user.location = currentUser.location ?? {
    ...emptyLocation(),
    custom: currentUser.city || '',
  }
}, { immediate: true })

async function saveProfile() {
  if (!is_valid_name(user.name)) {
    statusMessage.value = t('profile.nameRequired')
    return
  }

  if (!is_valid_phone(user.phone)) {
    statusMessage.value = t('profile.phoneFormat')
    return
  }

  if (!is_at_least_five_years_old(user.birthday)) {
    statusMessage.value = t('profile.birthdayFormat')
    return
  }

  if (!is_valid_email(user.email)) {
    statusMessage.value = t('profile.emailFormat')
    return
  }
  if (user.hobbies.length > MAX_USER_HOBBIES_LENGTH) {
    statusMessage.value = t('profile.hobbiesTooLong')
    return
  }

  statusMessage.value = ''
  try {
    const packet = await post('/wpi/user/profile', loading, {
      name: user.name,
      phone: user.phone,
      email: user.email,
      birthday: user.birthday,
      hobbies: user.hobbies,
      location: user.location,
    })
    const profile = packet.data as AuthUser | undefined
    if (!profile?.tag) {
      throw new Error(t('profile.saveFailed'))
    }
    auth.updateUserProfile(profile)
    statusMessage.value = t('profile.saved')
  } catch (error) {
    const result = error as { msg?: string; message?: string }
    statusMessage.value = result.msg || result.message || t('profile.saveFailed')
  }
}
</script>

<template>
  <section class="panel">
    <div class="section-head">
      <div>
        <p class="eyebrow">{{ t('profile.eyebrow') }}</p>
        <h2>{{ t('profile.title') }}</h2>
      </div>
      <button class="primary-button" type="button" :disabled="loading" @click="saveProfile">
        {{ t('profile.save') }}
      </button>
    </div>

    <div v-if="statusMessage" class="status-banner" role="status">
      {{ statusMessage }}
    </div>

    <div class="field-grid">
      <label>
        <span>{{ t('common.account') }}</span>
        <input v-model="user.account" type="text" readonly />
      </label>
      <label>
        <span>{{ t('profile.username') }}</span>
        <input v-model="user.name" type="text" />
      </label>
      <label>
        <span>{{ t('common.phone') }}</span>
        <input v-model="user.phone" type="tel" inputmode="numeric" maxlength="11" required />
      </label>
      <label>
        <span>{{ t('profile.email') }}</span>
        <input v-model="user.email" type="email" />
      </label>
      <label>
        <span>{{ t('profile.birthday') }}</span>
        <input v-model="user.birthday" type="date" required />
      </label>
      <div class="full-width location-field">
        <span>{{ t('profile.city') }}</span>
        <LocationPicker v-model="user.location" />
      </div>
      <label class="full-width">
        <span>{{ t('profile.hobbies') }}</span>
        <HobbiesPicker v-model="user.hobbies" />
      </label>
    </div>
  </section>
</template>

<style scoped lang="scss">
.panel {
  padding: 0;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.4rem;
}

.eyebrow {
  margin: 0 0 0.4rem;
  color: var(--space-gold);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

h2 {
  margin: 0;
  font-size: 1.5rem;
  letter-spacing: -0.04em;
}

.primary-button {
  border: 0;
  border-radius: 10px;
  padding: 0.8rem 1.2rem;
  background: var(--space-gold);
  color: #091728;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.status-banner {
  margin-bottom: 1rem;
  padding: 0.9rem 1rem;
  border-radius: 12px;
  background: rgba(92, 171, 218, .14);
  color: #b9d9f2;
  font-weight: 600;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  color: #c3d5e7;
  font-size: 0.85rem;
  font-weight: 600;
}

input,
textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--space-line);
  border-radius: 10px;
  padding: 0.8rem 0.85rem;
  font: inherit;
  background: rgba(13, 38, 67, .72);
  color: var(--space-text);
}

input[readonly] {
  background: rgba(5, 18, 36, .62);
  color: var(--space-muted);
}

textarea {
  resize: vertical;
}

.full-width {
  grid-column: 1 / -1;
}

.location-field {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  color: #c3d5e7;
  font-size: 0.85rem;
  font-weight: 600;
}

@media (max-width: 860px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
