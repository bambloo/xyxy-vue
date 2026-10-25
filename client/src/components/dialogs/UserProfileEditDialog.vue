<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore, type AuthUser } from '@/stores/auth'
import { clearDailyFirstVisitCompleted } from '@/events/time-fortune'
import { post } from '@/scripts/request'
import { hash_password } from '../../../../common/util/crypto'
import { MAX_USER_HOBBIES_LENGTH, type UserPublicProfile } from '../../../../common/entity/user'
import { validatePassword } from '@/utils/login-validator'
import {
  is_at_least_five_years_old,
  is_valid_email,
  is_valid_name,
  is_valid_phone,
  is_valid_url,
} from '@/utils/user-validator'

const props = defineProps<{ open: boolean; activationTag?: string }>()
const emit = defineEmits<{ close: [] }>()

const auth = useAuthStore()
const router = useRouter()
const { t } = useI18n()
const isActivation = computed(() => Boolean(props.activationTag))
const HobbiesPicker = defineAsyncComponent(() => import('@/components/HobbiesPicker.vue'))
const loading = ref(false)
const statusMessage = ref('')
const saveSuccessVisible = ref(false)
let saveSuccessTimer: number | undefined
const form = reactive({
  name: '',
  phone: '',
  email: '',
  birthday: '',
  hobbies: '',
  city: '',
  avatar: '',
  password: '',
  confirmPassword: '',
})

watch(
  () => props.open,
  (open) => {
    const currentUser = auth.currentUser
    if (!open) return
    form.name = currentUser?.name || ''
    form.phone = currentUser?.phone || ''
    form.email = currentUser?.email || ''
    form.birthday = currentUser?.birthday || ''
    form.hobbies = currentUser?.hobbies || ''
    form.city =
      currentUser?.location?.city || currentUser?.location?.custom || currentUser?.city || ''
    form.avatar = ''
    form.password = ''
    form.confirmPassword = ''
    statusMessage.value = ''
    saveSuccessVisible.value = false
    if (saveSuccessTimer !== undefined) {
      window.clearTimeout(saveSuccessTimer)
      saveSuccessTimer = undefined
    }
  },
  { immediate: true },
)

function showSaveSuccessMessage() {
  saveSuccessVisible.value = true
  if (saveSuccessTimer !== undefined) window.clearTimeout(saveSuccessTimer)
  saveSuccessTimer = window.setTimeout(() => {
    saveSuccessVisible.value = false
    saveSuccessTimer = undefined
  }, 2500)
}

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
  if (isActivation.value) {
    if (!is_valid_url(form.avatar)) {
      statusMessage.value = t('profile.avatarFormat')
      return
    }
    if (validatePassword(form.password)) {
      statusMessage.value = t('validation.passwordFormat')
      return
    }
    if (form.password !== form.confirmPassword) {
      statusMessage.value = t('password.mismatch')
      return
    }
    await activateTag()
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
      city: form.city,
    })
    const profile = packet.data as AuthUser | undefined
    if (!profile?.tag) throw new Error(t('profile.saveFailed'))
    auth.updateUserProfile(profile)
    showSaveSuccessMessage()
  } catch (error) {
    const result = error as { msg?: string; message?: string }
    statusMessage.value = result.msg || result.message || t('profile.saveFailed')
  }
}

async function activateTag() {
  statusMessage.value = ''
  try {
    const passwordHash = await hash_password(form.password)
    const packet = await post('/wpi/user/activate', loading, {
      tag: props.activationTag,
      name: form.name,
      phone: form.phone,
      email: form.email,
      birthday: form.birthday,
      hobbies: form.hobbies,
      avatar: form.avatar,
      passwordHash,
    })
    const data = packet.data as (UserPublicProfile & { token?: string }) | undefined
    if (!data?.token || !data.account || !data.tag) throw new Error(t('tag.activateError'))
    const { token, ...profile } = data
    clearDailyFirstVisitCompleted(profile.tag)
    auth.login(token, profile)
    await router.replace({ name: 'galaxy' })
    emit('close')
  } catch (error) {
    const result = error as { msg?: string; message?: string }
    statusMessage.value = result.msg || result.message || t('tag.activateError')
  }
}

onBeforeUnmount(() => {
  if (saveSuccessTimer !== undefined) window.clearTimeout(saveSuccessTimer)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="profile-editor">
      <div v-if="open" class="profile-editor-overlay" @click.self="emit('close')">
        <section class="profile-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-editor-title">
          <button class="profile-editor-close" type="button" :aria-label="t('common.close')" @click="emit('close')">
            <ion-icon name="close-outline" aria-hidden="true"></ion-icon>
          </button>
          <h2 id="profile-editor-title">
            {{ isActivation ? t('tag.activateTitle') : t('profile.title') }}
          </h2>
          <form @submit.prevent="saveProfile">
            <div class="profile-editor-fields">
              <label v-if="isActivation" class="profile-editor-row profile-editor-full-width">
                <span>{{ t('tag.tagLabel') }}</span>
                <input :value="activationTag" type="text" readonly aria-readonly="true" />
              </label>
              <label class="profile-editor-row">
                <span>{{ t('profile.username') }}</span>
                <input v-model="form.name" type="text" autocomplete="name" required />
              </label>
              <label class="profile-editor-row">
                <span>{{ t('common.phone') }}</span>
                <input v-model="form.phone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="11" required />
              </label>
              <label class="profile-editor-row">
                <span>{{ t('profile.email') }}</span>
                <input v-model="form.email" type="email" autocomplete="email" />
              </label>
              <label class="profile-editor-row">
                <span>{{ t('profile.birthday') }}</span>
                <input v-model="form.birthday" type="date" required />
              </label>
              <label v-if="!isActivation" class="profile-editor-row profile-editor-full-width">
                <span>{{ t('profile.city') }}</span>
                <input v-model="form.city" type="text" maxlength="500" />
              </label>
              <template v-if="isActivation">
                <label class="profile-editor-row">
                  <span>{{ t('login.passwordLabel') }}</span>
                  <input v-model="form.password" type="password" autocomplete="new-password"
                    :placeholder="t('login.passwordPlaceholder')" required />
                </label>
                <label class="profile-editor-row">
                  <span>{{ t('password.confirm') }}</span>
                  <input v-model="form.confirmPassword" type="password" autocomplete="new-password"
                    :placeholder="t('password.confirmPlaceholder')" required />
                </label>
                <label class="profile-editor-row profile-editor-full-width">
                  <span>{{ t('tag.avatar') }}</span>
                  <input v-model="form.avatar" type="url" />
                </label>
              </template>
              <label class="profile-editor-full-width">
                <span>{{ t('profile.hobbies') }}</span>
                <HobbiesPicker v-model="form.hobbies" />
              </label>
            </div>
            <p v-if="statusMessage" class="profile-editor-status" role="status">
              {{ statusMessage }}
            </p>
            <div class="profile-editor-actions">
              <Transition name="profile-success">
                <p v-if="saveSuccessVisible" class="profile-save-success" role="status">
                  <ion-icon name="checkmark-circle" aria-hidden="true"></ion-icon>
                  {{ t('profile.saved') }}
                </p>
              </Transition>
              <button type="submit" class="profile-editor-primary" :disabled="loading">
                {{ loading ? t('common.loading') : isActivation ? t('tag.activateButton') : t('profile.save') }}
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

.profile-save-success {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 auto 0 0;
  color: #dff7e7;
  font-size: 12px;
  white-space: nowrap;
}

.profile-save-success ion-icon {
  flex: 0 0 auto;
  color: #8fe3ae;
  font-size: 17px;
}

.profile-success-enter-active,
.profile-success-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.profile-success-enter-from,
.profile-success-leave-to {
  opacity: 0;
  transform: translateX(-6px);
}

.profile-editor-dialog {
  position: relative;
  box-sizing: border-box;
  width: min(520px, 100%);
  height: min(720px,
      var(--dialog-available-height, calc(100vh - 24px - clamp(112px, 13vh, 168px) - 104px)));
  overflow: auto;
  scrollbar-width: none;
  padding: 34px clamp(24px, 6vw, 48px) 24px;
  border: 0;
  border-radius: 24px;
  background: transparent;
  box-shadow: none;
  color: #e8f1fb;
}

.profile-editor-close {
  position: absolute;
  top: 12px;
  right: 12px;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(166, 202, 239, .22);
  border-radius: 50%;
  background: rgba(13, 38, 67, .72);
  color: #e8f1fb;
  font-size: 20px;
  cursor: pointer;
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
  grid-template-columns: minmax(0, 1fr);
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

input[type='date']::-webkit-calendar-picker-indicator {
  filter: invert(1);
  opacity: 1;
  cursor: pointer;
}

textarea {
  resize: vertical;
}

.profile-editor-full-width {
  grid-column: 1 / -1;
}

.profile-editor-row {
  display: grid;
  grid-template-columns: minmax(70px, 0.6fr) minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(195, 213, 231, 0.42);
}

.profile-editor-row input {
  min-width: 0;
  border: 0;
  border-radius: 0;
  padding: 8px 0;
  background: transparent;
  text-align: right;
}

.profile-editor-row input:focus {
  outline: none;
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
