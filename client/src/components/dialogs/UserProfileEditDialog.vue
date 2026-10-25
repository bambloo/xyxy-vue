<script setup lang="ts">
import { defineAsyncComponent, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore, type AuthUser } from '@/stores/auth'
import { requestTopDialogClose } from '@/events/dialog-stack'
import { post } from '@/scripts/request'
import { MAX_USER_HOBBIES_LENGTH, type UserLocation } from '../../../../common/entity/user'
import {
  is_at_least_five_years_old,
  is_valid_email,
  is_valid_name,
  is_valid_phone,
} from '@/utils/user-validator'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const auth = useAuthStore()
const { t } = useI18n()
const LocationPicker = defineAsyncComponent(() => import('@/components/LocationPicker.vue'))
const HobbiesPicker = defineAsyncComponent(() => import('@/components/HobbiesPicker.vue'))
const loading = ref(false)
const statusMessage = ref('')
const emptyLocation = (): UserLocation => ({
  countryCode: 'CN',
  country: '中国',
  region: '',
  city: '',
  custom: '',
})
const form = reactive({
  name: '',
  phone: '',
  email: '',
  birthday: '',
  hobbies: '',
  location: emptyLocation(),
})

watch(
  () => props.open,
  (open) => {
    const currentUser = auth.currentUser
    if (!open || !currentUser) return
    form.name = currentUser.name
    form.phone = currentUser.phone || ''
    form.email = currentUser.email || ''
    form.birthday = currentUser.birthday || ''
    form.hobbies = currentUser.hobbies || ''
    form.location = currentUser.location ?? {
      ...emptyLocation(),
      custom: currentUser.city || '',
    }
    statusMessage.value = ''
  },
)

async function saveProfile() {
  if (!is_valid_name(form.name)) {
    statusMessage.value = t('profile.nameRequired')
    return
  }
  if (!is_valid_phone(form.phone)) {
    statusMessage.value = t('profile.phoneFormat')
    return
  }
  if (!is_at_least_five_years_old(form.birthday)) {
    statusMessage.value = t('profile.birthdayFormat')
    return
  }
  if (!is_valid_email(form.email)) {
    statusMessage.value = t('profile.emailFormat')
    return
  }
  if (form.hobbies.length > MAX_USER_HOBBIES_LENGTH) {
    statusMessage.value = t('profile.hobbiesTooLong')
    return
  }
  statusMessage.value = ''
  try {
    const packet = await post('/wpi/user/profile', loading, {
      name: form.name,
      phone: form.phone,
      email: form.email,
      birthday: form.birthday,
      hobbies: form.hobbies,
      location: form.location,
    })
    const profile = packet.data as AuthUser | undefined
    if (!profile?.tag) throw new Error(t('profile.saveFailed'))
    auth.updateUserProfile(profile)
    statusMessage.value = t('profile.saved')
  } catch (error) {
    const result = error as { msg?: string; message?: string }
    statusMessage.value = result.msg || result.message || t('profile.saveFailed')
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="profile-editor">
      <div v-if="open" class="profile-editor-overlay" @click.self="requestTopDialogClose">
        <section
          class="profile-editor-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-editor-title"
        >
          <p class="profile-editor-eyebrow">{{ t('profile.eyebrow') }}</p>
          <h2 id="profile-editor-title">{{ t('profile.title') }}</h2>
          <form @submit.prevent="saveProfile">
            <div class="profile-editor-fields">
              <label>
                <span>{{ t('profile.username') }}</span>
                <input v-model="form.name" type="text" autocomplete="name" required />
              </label>
              <label>
                <span>{{ t('common.phone') }}</span>
                <input
                  v-model="form.phone"
                  type="tel"
                  inputmode="numeric"
                  autocomplete="tel"
                  maxlength="11"
                  required
                />
              </label>
              <label>
                <span>{{ t('profile.email') }}</span>
                <input v-model="form.email" type="email" autocomplete="email" />
              </label>
              <label>
                <span>{{ t('profile.birthday') }}</span>
                <input v-model="form.birthday" type="date" required />
              </label>
              <div class="profile-editor-full-width">
                <p class="profile-editor-field-title">{{ t('profile.city') }}</p>
                <LocationPicker v-model="form.location" />
              </div>
              <label class="profile-editor-full-width">
                <span>{{ t('profile.hobbies') }}</span>
                <HobbiesPicker v-model="form.hobbies" />
              </label>
            </div>
            <p v-if="statusMessage" class="profile-editor-status" role="status">
              {{ statusMessage }}
            </p>
            <div class="profile-editor-actions">
              <button type="button" class="profile-editor-secondary" @click="emit('close')">
                {{ t('common.cancel') }}
              </button>
              <button type="submit" class="profile-editor-primary" :disabled="loading">
                {{ loading ? t('common.loading') : t('profile.save') }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.profile-editor-overlay {
  position: fixed;
  z-index: 1200;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px 24px var(--dialog-bottom-reserve, calc(clamp(112px, 13vh, 168px) + 104px));
  background: rgba(1, 7, 19, 0.36);
  backdrop-filter: blur(3px);
}

.profile-editor-dialog {
  position: relative;
  box-sizing: border-box;
  width: min(520px, 100%);
  height: min(
    720px,
    var(--dialog-available-height, calc(100vh - 24px - clamp(112px, 13vh, 168px) - 104px))
  );
  overflow: auto;
  scrollbar-width: none;
  padding: 34px clamp(24px, 6vw, 48px) 24px;
  border: 0;
  border-radius: 24px;
  background: transparent;
  box-shadow: none;
  color: #e8f1fb;
}

.profile-editor-dialog::-webkit-scrollbar {
  display: none;
}

.profile-editor-eyebrow {
  margin: 0;
  color: #96bce7;
  font-size: 10px;
  letter-spacing: .2em;
  text-align: center;
}

h2 {
  margin: 8px 0 26px;
  color: #f4e6bf;
  font-size: 25px;
  font-weight: 500;
  letter-spacing: 0.18em;
  text-align: center;
}

.profile-editor-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
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

input,
textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(166, 202, 239, .22);
  border-radius: 9px;
  padding: 10px 11px;
  background: rgba(13, 38, 67, .78);
  color: #e8f1fb;
  font: inherit;
}

textarea {
  resize: vertical;
}

.profile-editor-full-width {
  grid-column: 1 / -1;
}

.profile-editor-field-title {
  margin: 0 0 7px;
  color: #c3d5e7;
  font-size: 13px;
  font-weight: 600;
}

.profile-editor-status {
  margin: 14px 0 0;
  color: #b9d9f2;
  font-weight: 600;
}

.profile-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.profile-editor-actions button {
  border: 0;
  border-radius: 9px;
  padding: 10px 15px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.profile-editor-primary {
  background: #f0bd63;
  color: #091728;
}

.profile-editor-secondary {
  border: 1px solid rgba(166, 202, 239, .3) !important;
  background: transparent;
  color: #d3e2f1;
}

.profile-editor-primary:disabled {
  cursor: wait;
  opacity: .65;
}

.profile-editor-enter-active,
.profile-editor-leave-active {
  transition: opacity 180ms ease;
}

.profile-editor-enter-from,
.profile-editor-leave-to {
  opacity: 0;
}

@media (max-width: 560px) {
  .profile-editor-overlay {
    padding: 16px 16px var(--dialog-bottom-reserve, calc(clamp(112px, 13vh, 168px) + 104px));
  }

  .profile-editor-fields {
    grid-template-columns: 1fr;
  }

  .profile-editor-full-width {
    grid-column: auto;
  }
}
</style>
