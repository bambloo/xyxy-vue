<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { hash_password } from '../../../common/util/crypto'
import { post } from '@/scripts/request'
import { useAuthStore } from '@/stores/auth'
import { validateAccount, validatePassword } from '../utils/login-validator'
import type { UserPublicProfile } from '../../../common/entity/user'
import {
  is_at_least_five_years_old,
  is_valid_email,
  is_valid_name,
  is_valid_phone,
  is_valid_url,
} from '../utils/user-validator'

const props = defineProps<{ tag: string; active: boolean }>()
const router = useRouter()
const auth = useAuthStore()
const { t } = useI18n()
const loginRequired = ref(props.active)
const password = ref('')
const loginLoading = ref(false)
const sessionLoading = ref(false)
const loginError = ref('')
const accountError = ref('')
const passwordError = ref('')
const account = ref(props.tag)
const activationLoading = ref(false)
const activationMessage = ref('')
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

function translateValidation(message: string) {
  const messages: Record<string, string> = {
    '请输入账号': t('validation.accountRequired'),
    '账号需为 4-20 位字母、数字或下划线，手机号可直接输入 11 位数字': t('validation.accountFormat'),
    '请输入密码': t('validation.passwordRequired'),
    '密码需为 8-20 位，且至少包含字母和数字': t('validation.passwordFormat'),
  }
  return messages[message] || message
}

function submitLogin() {
  loginError.value = ''
  accountError.value = translateValidation(validateAccount(account.value))
  passwordError.value = translateValidation(validatePassword(password.value))
  if (accountError.value || passwordError.value) return

  hash_password(password.value)
    .then((passwordHash) => post('/wpi/user/login', loginLoading, {
      account: account.value.trim(),
      passwordHash,
    }))
    .then((packet) => {
      const data = packet.data as (UserPublicProfile & { token?: string }) | undefined
      if (!data?.token || !data.account || !data.tag) throw new Error(t('login.missingToken'))
      const { token, ...profile } = data
      auth.login(token, profile)
      return router.replace({ name: 'home' })
    })
    .catch((error: unknown) => {
      const result = error as { msg?: string; message?: string }
      loginError.value = result.msg || result.message || t('login.invalid')
    })
}

async function activate() {
  activationMessage.value = ''
  if (!is_valid_name(user.name)) {
    activationMessage.value = t('profile.nameRequired')
    return
  }

  if (!is_valid_phone(user.phone)) {
    activationMessage.value = t('profile.phoneFormat')
    return
  }

  if (!is_valid_email(user.email)) {
    activationMessage.value = t('profile.emailFormat')
    return
  }

  if (!is_valid_url(user.avatar)) {
    activationMessage.value = t('profile.avatarFormat')
    return
  }

  if (!is_at_least_five_years_old(user.birthday)) {
    activationMessage.value = t('profile.birthdayFormat')
    return
  }

  if (validatePassword(user.password)) {
    activationMessage.value = t('validation.passwordFormat')
    return
  }

  if (user.password !== user.confirmPassword) {
    activationMessage.value = t('password.mismatch')
    return
  }

  try {
    const passwordHash = await hash_password(user.password)
    const { password, confirmPassword, ...profileData } = user
    const packet = await post('/wpi/user/activate', activationLoading, {
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
    activationMessage.value = result.msg || result.message || t('tag.activateError')
  }
}

onMounted(async () => {
  if (!props.active) return

  try {
    const packet = await post('/wpi/user/check', sessionLoading)
    const data = packet.data as (UserPublicProfile & { token?: string }) | undefined
    if (!data?.token || !data.account || !data.tag) throw new Error('Invalid session response')
    const { token, ...profile } = data
    auth.login(token, profile)
    await router.replace({ name: 'home' })
  } catch {
    auth.clear()
  }
})
</script>
<template>
  <section v-if="!active" class="activation-panel">
    <p class="eyebrow">{{ t('tag.activateEyebrow') }}</p>
    <h1>{{ t('tag.activateTitle') }}</h1>
    <form class="activation-form" @submit.prevent="activate">
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
      <p v-if="activationMessage" class="error-message" role="alert">{{ activationMessage }}</p>
      <button class="full-width" type="submit" :disabled="activationLoading">
        {{ activationLoading ? t('tag.activating') : t('tag.activateButton') }}
      </button>
    </form>
  </section>

  <div v-else-if="loginRequired" class="login-modal" role="dialog" aria-modal="true" :aria-label="t('login.title')">
    <form class="login-dialog" @submit.prevent="submitLogin">
      <button class="close-button" type="button" aria-label="关闭" @click="loginRequired = false">×</button>
      <p class="eyebrow">{{ t('login.kicker') }}</p>
      <h1>{{ t('login.title') }}</h1>
      <p class="login-intro">{{ t('login.intro') }}</p>

      <label for="tag-login-account">{{ t('login.accountLabel') }}</label>
      <input id="tag-login-account" v-model="account" type="text" autocomplete="username" readonly
        :placeholder="t('login.accountPlaceholder')" />
      <p v-if="accountError" class="field-error" role="alert">{{ accountError }}</p>

      <label for="tag-login-password">{{ t('login.passwordLabel') }}</label>
      <input id="tag-login-password" v-model="password" type="password" autocomplete="current-password"
        :placeholder="t('login.passwordPlaceholder')" />
      <p v-if="passwordError" class="field-error" role="alert">{{ passwordError }}</p>

      <p v-if="loginError" class="error-message" role="alert">{{ loginError }}</p>
      <button class="submit-button" type="submit" :disabled="loginLoading">
        {{ loginLoading ? t('login.entering') : t('login.enter') }}
      </button>
    </form>
  </div>
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

.activation-panel h1 {
  margin: 0;
}

.activation-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.activation-form label {
  display: grid;
  gap: .45rem;
  color: var(--space-text);
  font-size: .85rem;
}

.activation-form input,
.activation-form textarea {
  box-sizing: border-box;
  width: 100%;
  padding: .75rem;
  border: 1px solid var(--space-line);
  border-radius: 8px;
  background: rgba(13, 38, 67, .72);
  color: var(--space-text);
  font: inherit;
}

.activation-form input[readonly] {
  background: rgba(5, 18, 36, .62);
  color: var(--space-muted);
  cursor: not-allowed;
}

.full-width {
  grid-column: 1 / -1;
}

.activation-form button {
  padding: .8rem 1rem;
  border: 0;
  border-radius: 8px;
  background: var(--space-gold);
  color: #091728;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.activation-form button:disabled {
  opacity: .6;
  cursor: wait;
}

.error-message {
  margin: 0;
  color: #ffb4a8;
}

.login-modal {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(3, 12, 25, .72);
}

.login-dialog {
  position: relative;
  display: grid;
  width: min(25rem, 100%);
  gap: .55rem;
  padding: 2rem;
  border: 1px solid var(--space-line);
  border-radius: 16px;
  background: var(--space-panel);
  color: var(--space-text);
  box-shadow: 0 18px 50px rgba(0, 0, 0, .3);
}

.close-button {
  position: absolute;
  top: .75rem;
  right: .75rem;
  border: 0;
  background: transparent;
  color: var(--space-muted);
  font-size: 1.5rem;
  cursor: pointer;
}

.eyebrow {
  margin: 0 0 .25rem;
  color: var(--space-gold);
  font-size: .72rem;
  font-weight: 700;
  letter-spacing: .16em;
}

.login-dialog h1 {
  margin: 0;
}

.login-intro {
  margin: 0 0 .75rem;
  color: var(--space-muted);
}

.login-dialog input {
  width: 100%;
  box-sizing: border-box;
  padding: .75rem;
  border: 1px solid var(--space-line);
  border-radius: 8px;
  background: rgba(13, 38, 67, .72);
  color: var(--space-text);
  font: inherit;
}

.field-error,
.error-message {
  margin: 0;
  color: #ffb4a8;
  font-size: .82rem;
}

.submit-button {
  margin-top: .75rem;
  padding: .8rem 1rem;
  border: 0;
  border-radius: 8px;
  background: var(--space-gold);
  color: #091728;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.submit-button:disabled {
  cursor: wait;
  opacity: .6;
}

@media (max-width: 620px) {
  .activation-form {
    grid-template-columns: 1fr;
  }
}
</style>
