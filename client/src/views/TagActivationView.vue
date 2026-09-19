<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { hash_password } from '../../../common/util/crypto'
import { post } from '@/scripts/request'
import { useAuthStore } from '@/stores/auth'
import { validatePassword } from '../utils/login-validator'
import type { UserPublicProfile } from '../../../common/entity/user'
import {
  is_at_least_five_years_old,
  is_valid_email,
  is_valid_name,
  is_valid_phone,
  is_valid_url,
} from '../utils/user-validator'

const props = defineProps<{ tag: string }>()
const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const message = ref('')
const completed = ref(false)
const user = reactive({
  name: '',
  password: '',
  confirmPassword: '',
  phone: '',
  email: '',
  birthday: '',
  hobbies: '',
  avatar: '',
})

async function activate() {
  message.value = ''
  if (!is_valid_name(user.name)) {
    message.value = t('profile.nameRequired')
    return
  }

  if (!is_valid_phone(user.phone)) {
    message.value = t('profile.phoneFormat')
    return
  }

  if (!is_valid_email(user.email)) {
    message.value = t('profile.emailFormat')
    return
  }

  if (!is_valid_url(user.avatar)) {
    message.value = t('profile.avatarFormat')
    return
  }

  if (!is_at_least_five_years_old(user.birthday)) {
    message.value = t('profile.birthdayFormat')
    return
  }

  const passwordError = validatePassword(user.password)
  if (passwordError) {
    message.value = t('validation.passwordFormat')
    return
  }

  if (user.password !== user.confirmPassword) {
    message.value = t('password.mismatch')
    return
  }

  try {
    const passwordHash = await hash_password(user.password)
    const { password, confirmPassword, ...profileData } = user

    console.log(user, profileData)
    const packet = await post('/wpi/user/activate', loading, {
      tag: props.tag,
      ...profileData,
      passwordHash,
    })
    const data = packet.data as (UserPublicProfile & { token?: string }) | undefined
    if (!data?.token || !data.account || !data.tag) throw new Error(t('tag.activateError'))
    const { token, ...profile } = data
    auth.login(token, profile)
    await router.replace({ name: 'home' })
  } catch (error: unknown) {
    const result = error as { msg?: string; message?: string }
    message.value = result.msg || result.message || t('tag.activateError')
  }
}
</script>

<template>
  <section class="activation-panel">
    <template v-if="!completed">
      <p class="eyebrow">{{ t('tag.activateEyebrow') }}</p>
      <h1>{{ t('tag.activateTitle') }}</h1>
      <form @submit.prevent="activate">
        <label class="full-width"><span>{{ t('tag.tagLabel') }}</span><input :value="tag" type="text" readonly
            aria-readonly="true" /></label>
        <label><span>{{ t('common.name') }}</span><input v-model="user.name" required type="text"
            maxlength="100" /></label>
        <label><span>{{ t('common.phone') }}</span><input v-model="user.phone" type="tel" inputmode="numeric"
            maxlength="11" required /></label>
        <label><span>{{ t('login.passwordLabel') }}</span><input v-model="user.password" required type="password"
            autocomplete="new-password" :placeholder="t('login.passwordPlaceholder')" /></label>
        <label><span>{{ t('password.confirm') }}</span><input v-model="user.confirmPassword" required type="password"
            autocomplete="new-password" :placeholder="t('password.confirmPlaceholder')" /></label>
        <label><span>{{ t('profile.email') }}</span><input v-model="user.email" type="email" /></label>
        <label><span>{{ t('profile.birthday') }}</span><input v-model="user.birthday" type="date" required /></label>
        <label class="full-width"><span>{{ t('profile.hobbies') }}</span><textarea v-model="user.hobbies"
            rows="4" /></label>
        <label class="full-width"><span>{{ t('tag.avatar') }}</span><input v-model="user.avatar" type="url" /></label>
        <p v-if="message" class="error-message" role="alert">{{ message }}</p>
        <button type="submit" :disabled="loading">{{ loading ? t('tag.activating') : t('tag.activateButton') }}</button>
      </form>
    </template>
    <p v-else class="success-message" role="status">{{ t('tag.activateSuccess') }}</p>
  </section>
</template>

<style scoped>
.activation-panel {
  width: min(680px, calc(100% - 2rem));
  margin: 4rem auto;
  padding: 2rem;
  box-sizing: border-box;
  border: 1px solid var(--space-line);
  border-radius: 16px;
  background: var(--space-panel);
  backdrop-filter: blur(16px);
}

.eyebrow {
  margin: 0 0 .5rem;
  color: var(--space-gold);
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .14em;
}

h1 {
  margin: 0;
}

.tag-value {
  color: var(--space-muted);
}

form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

label {
  display: grid;
  gap: .45rem;
  color: var(--space-text);
  font-size: .85rem;
}

input,
textarea {
  box-sizing: border-box;
  width: 100%;
  padding: .75rem;
  border: 1px solid var(--space-line);
  border-radius: 8px;
  background: rgba(13, 38, 67, .72);
  color: var(--space-text);
  font: inherit;
}

input[readonly] {
  background: rgba(5, 18, 36, .62);
  color: var(--space-muted);
  cursor: not-allowed;
}

.full-width,
.error-message,
button {
  grid-column: 1 / -1;
}

button {
  padding: .8rem 1rem;
  border: 0;
  border-radius: 8px;
  background: var(--space-gold);
  color: #091728;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

button:disabled {
  opacity: .6;
  cursor: wait;
}

.error-message {
  margin: 0;
  color: #ffb4a8;
}

.success-message {
  color: #b9d9f2;
  font-weight: 700;
}

@media (max-width: 620px) {
  form {
    grid-template-columns: 1fr;
  }
}
</style>
