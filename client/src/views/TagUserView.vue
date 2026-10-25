<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { hash_password } from '../../../common/util/crypto'
import { post } from '@/scripts/request'
import { useAuthStore } from '@/stores/auth'
import { validateAccount, validatePassword } from '../utils/login-validator'
import type { UserPublicProfile } from '../../../common/entity/user'

const props = defineProps<{ tag: string }>()
const router = useRouter()
const auth = useAuthStore()
const { t } = useI18n()
const loginRequired = ref(true)
const password = ref('')
const loginLoading = ref(false)
const sessionLoading = ref(false)
const loginError = ref('')
const accountError = ref('')
const passwordError = ref('')
const account = ref(props.tag)

function translateValidation(message: string) {
  const messages: Record<string, string> = {
    请输入账号: t('validation.accountRequired'),
    '账号需为 4-20 位字母、数字或下划线，手机号可直接输入 11 位数字': t('validation.accountFormat'),
    请输入密码: t('validation.passwordRequired'),
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
    .then((passwordHash) =>
      post('/wpi/user/login', loginLoading, {
        account: account.value.trim(),
        passwordHash,
      }),
    )
    .then((packet) => {
      const data = packet.data as (UserPublicProfile & { token?: string }) | undefined
      if (!data?.token || !data.account || !data.tag) throw new Error(t('login.missingToken'))
      const { token, ...profile } = data
      auth.login(token, profile)
      return router.replace({ name: 'galaxy' })
    })
    .catch((error: unknown) => {
      auth.clear()
      const result = error as { msg?: string; message?: string }
      loginError.value = result.msg || result.message || t('login.invalid')
    })
}

onMounted(async () => {
  try {
    const packet = await post('/wpi/user/check', sessionLoading, { tag: props.tag })
    const data = packet.data as (UserPublicProfile & { token?: string }) | undefined
    if (!data?.token || !data.account || !data.tag) throw new Error('Invalid session response')
    const { token, ...profile } = data
    auth.login(token, profile)
    await router.replace({ name: 'galaxy' })
  } catch {
    auth.clear()
  }
})
</script>

<template>
  <div v-if="loginRequired" class="login-modal" role="dialog" aria-modal="true" :aria-label="t('login.title')"
    @click.self="loginRequired = false">
    <form class="login-dialog" @submit.prevent="submitLogin">
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
      <button class="submit-button" type="submit" :disabled="loginLoading || sessionLoading">
        {{ loginLoading ? t('login.entering') : t('login.enter') }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login-modal {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(3, 12, 25, 0.72);
}

.login-dialog {
  position: relative;
  display: grid;
  width: min(25rem, 100%);
  gap: 0.55rem;
  padding: 2rem;
  border: 1px solid var(--space-line);
  border-radius: 16px;
  background: var(--space-panel);
  color: var(--space-text);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.3);
}

.eyebrow {
  margin: 0 0 0.25rem;
  color: var(--space-gold);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.login-dialog h1 {
  margin: 0;
}

.login-intro {
  margin: 0 0 0.75rem;
  color: var(--space-muted);
}

.login-dialog input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.75rem;
  border: 1px solid var(--space-line);
  border-radius: 8px;
  background: rgba(13, 38, 67, 0.72);
  color: var(--space-text);
  font: inherit;
}

.field-error,
.error-message {
  margin: 0;
  color: #ffb4a8;
  font-size: 0.82rem;
}

.submit-button {
  margin-top: 0.75rem;
  padding: 0.8rem 1rem;
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
  opacity: 0.6;
}
</style>
