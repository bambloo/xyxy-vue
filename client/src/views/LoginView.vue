<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { hash_password } from '../../../common/util/crypto'
import { validateAccount, validatePassword } from '../utils/login-validator'
import { post } from '../scripts/request'
import { useAuthStore } from '../stores/auth'
import { toggleLocale } from '../i18n'
import { useI18n } from 'vue-i18n'
import type { UserPublicProfile } from '../../../common/entity/user'

const router = useRouter()
const auth = useAuthStore()
const { t } = useI18n()
const account = ref('')
const password = ref('')
const rememberMe = ref(true)
const showPassword = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const accountError = ref('')
const passwordError = ref('')

function validateLoginForm() {
  accountError.value = translateValidation(validateAccount(account.value))
  passwordError.value = translateValidation(validatePassword(password.value))

  return !accountError.value && !passwordError.value
}

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
  errorMessage.value = ''

  if (!validateLoginForm()) {
    return
  }

  hash_password(password.value)
    .then((passwordHash) => {
      return post('/wpi/user/login', loading, {
        account: account.value.trim(),
        passwordHash,
        remember: rememberMe.value,
      })
    })
    .then((packet) => {
      const data = packet.data as (UserPublicProfile & { token?: string }) | undefined
      if (!data?.token || !data.account || !data.tag) throw new Error(t('login.missingToken'))
      const { token, ...profile } = data
      auth.login(token, profile)
      router.push('/user')
    })
    .catch((error: unknown) => {
      const response = error as { msg?: string; message?: string }
      errorMessage.value = response.msg || response.message || t('login.invalid')
    })
}
</script>

<template>
  <main class="login-page">
    <section class="welcome-panel" :aria-label="t('login.ariaIntro')">
      <div class="brand-mark">B</div>
      <p class="eyebrow">{{ t('login.welcome') }}</p>
      <h1>{{ t('login.headline') }}<br /><em>{{ t('login.headlineAccent') }}</em></h1>
      <div class="orb orb-one"></div>
      <div class="orb orb-two"></div>
      <div class="line-pattern"></div>
    </section>

    <section class="form-panel">
      <div class="form-wrap">
        <div class="mobile-brand"><span class="brand-mark">B</span> Bambloo</div>
        <button class="locale-button" type="button" @click="toggleLocale">{{ t('common.language') }}</button>
        <p class="form-kicker">{{ t('login.kicker') }}</p>
        <h2>{{ t('login.title') }}</h2>
        <p class="form-intro">{{ t('login.intro') }}</p>

        <form class="login-form" @submit.prevent="submitLogin">
          <label class="field-label" for="account">{{ t('login.accountLabel') }}</label>
          <div :class="['input-shell', { error: accountError }]">
            <ion-icon name="person-outline"></ion-icon>
            <input id="account" v-model="account" type="text" autocomplete="username"
              :placeholder="t('login.accountPlaceholder')" />
          </div>
          <p v-if="accountError" class="field-error" role="alert">{{ accountError }}</p>

          <div class="password-heading">
            <label class="field-label" for="password">{{ t('login.passwordLabel') }}</label>
            <a href="#" @click.prevent="errorMessage = t('login.forgotMessage')">{{ t('login.forgot') }}</a>
          </div>
          <div :class="['input-shell', { error: passwordError }]">
            <ion-icon name="lock-closed-outline"></ion-icon>
            <input id="password" v-model="password" :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password" :placeholder="t('login.passwordPlaceholder')" />
            <button class="icon-button" type="button"
              :aria-label="showPassword ? t('login.hidePassword') : t('login.showPassword')"
              @click="showPassword = !showPassword">
              <ion-icon :name="showPassword ? 'eye-off-outline' : 'eye-outline'"></ion-icon>
            </button>
          </div>
          <p v-if="passwordError" class="field-error" role="alert">{{ passwordError }}</p>

          <label class="remember-row">
            <input v-model="rememberMe" type="checkbox" />
            <span>{{ t('login.remember') }}</span>
          </label>

          <p v-if="errorMessage" class="error-message" role="alert">
            <ion-icon name="alert-circle-outline"></ion-icon>{{ errorMessage }}
          </p>
          <button class="submit-button" type="submit" :disabled="loading">
            <span>{{ loading ? t('login.entering') : t('login.enter') }}</span>
            <ion-icon v-if="!loading" name="arrow-forward-outline"></ion-icon>
          </button>
        </form>

        <p class="signup-hint">{{ t('login.signup') }} <a href="#"
            @click.prevent="errorMessage = t('login.signupMessage')">{{ t('login.signupAction') }}</a></p>
      </div>
      <p class="copyright">{{ t('login.copyright') }}</p>
    </section>
  </main>
</template>

<style scoped lang="scss">
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;1,600&display=swap');

.login-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 45% 55%;
  background: #f8f7f3;
  color: #172222;
  font-family: 'DM Sans', sans-serif;
}

.welcome-panel {
  position: relative;
  overflow: hidden;
  padding: clamp(2rem, 7vw, 7rem);
  color: #f7f3eb;
  background: #153f3d;
}

.brand-mark {
  display: inline-grid;
  place-items: center;
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 50%;
  color: #153f3d;
  background: #e9b45e;
  font-size: 1.4rem;
  font-weight: 700;
}

.eyebrow,
.form-kicker {
  margin: 4rem 0 1.5rem;
  color: #e9b45e;
  font-size: .72rem;
  font-weight: 700;
  letter-spacing: .2em;
}

h1 {
  position: relative;
  z-index: 1;
  margin: 0;
  font-size: clamp(2.4rem, 4.2vw, 4.5rem);
  line-height: 1.15;
  letter-spacing: -.03em;
}

h1 em {
  color: #e9b45e;
  font-family: 'Playfair Display', serif;
  font-weight: 600;
}

.welcome-copy {
  position: relative;
  z-index: 1;
  max-width: 19rem;
  margin-top: 2rem;
  color: #b4cfca;
  line-height: 1.8;
}

.orb {
  position: absolute;
  border: 1px solid rgba(233, 180, 94, .35);
  border-radius: 50%;
}

.orb-one {
  right: -15%;
  bottom: -10%;
  width: 30rem;
  height: 30rem;
}

.orb-two {
  right: 10%;
  bottom: 13%;
  width: 12rem;
  height: 12rem;
  background: rgba(233, 180, 94, .08);
}

.line-pattern {
  position: absolute;
  right: 10%;
  top: 0;
  width: 1px;
  height: 100%;
  background: rgba(233, 180, 94, .2);
  transform: rotate(28deg);
  transform-origin: top;
}

.form-panel {
  display: grid;
  place-items: center;
  padding: 3rem;
}

.form-wrap {
  width: min(100%, 25rem);
}

.mobile-brand {
  display: none;
  align-items: center;
  gap: .7rem;
  font-weight: 700;
}

.mobile-brand .brand-mark {
  width: 2rem;
  height: 2rem;
  font-size: 1rem;
}

.locale-button {
  display: block;
  margin: 0 0 1.5rem auto;
  border: 1px solid var(--space-line);
  border-radius: 999px;
  padding: .35rem .7rem;
  background: rgba(110, 164, 214, .1);
  color: var(--space-muted);
  font: inherit;
  font-size: .72rem;
  cursor: pointer;
}

.form-kicker {
  margin: 0 0 1rem;
  color: #d28f2d;
}

h2 {
  margin: 0;
  font-size: 2.2rem;
  letter-spacing: -.04em;
}

.form-intro {
  margin: .7rem 0 2.5rem;
  color: #7f8b87;
  font-size: .92rem;
}

.login-form {
  display: flex;
  flex-direction: column;
}

.field-label {
  display: block;
  margin-bottom: .55rem;
  color: #334341;
  font-size: .8rem;
  font-weight: 600;
}

.password-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.4rem;
}

.password-heading .field-label {
  margin: 0;
}

a {
  color: #17736c;
  text-decoration: none;
  font-size: .78rem;
  font-weight: 600;
}

a:hover {
  text-decoration: underline;
}

.input-shell {
  display: flex;
  align-items: center;
  gap: .75rem;
  min-height: 3.25rem;
  padding: 0 .95rem;
  border: 1px solid #d8dfd9;
  border-radius: 4px;
  background: #fff;
  transition: border-color .2s, box-shadow .2s;
}

.input-shell:focus-within {
  border-color: #2c827a;
  box-shadow: 0 0 0 3px rgba(44, 130, 122, .1);
}

.input-shell.error {
  border-color: #bb4b43;
  box-shadow: 0 0 0 3px rgba(187, 75, 67, .08);
}

.input-shell>ion-icon {
  color: #8a9994;
  font-size: 1.1rem;
}

input:not([type='checkbox']) {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  color: #172222;
  background: transparent;
  font: inherit;
  font-size: .86rem;
}

input::placeholder {
  color: #abb5b1;
}

.icon-button {
  display: grid;
  place-items: center;
  padding: .2rem;
  border: 0;
  color: #8a9994;
  background: transparent;
  cursor: pointer;
}

.remember-row {
  display: flex;
  align-items: center;
  gap: .55rem;
  margin: 1.3rem 0 1.8rem;
  color: #687571;
  font-size: .8rem;
  cursor: pointer;
}

input[type='checkbox'] {
  width: 1rem;
  height: 1rem;
  accent-color: #237a72;
}

.field-error,
.error-message {
  display: flex;
  align-items: center;
  gap: .45rem;
  margin: .5rem 0 0;
  color: #bb4b43;
  font-size: .78rem;
}

.error-message {
  margin: -1rem 0 1rem;
}

.submit-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .8rem;
  min-height: 3.35rem;
  border: 0;
  border-radius: 4px;
  color: #fff;
  background: #1c5c58;
  font: inherit;
  font-size: .9rem;
  font-weight: 700;
  cursor: pointer;
  transition: background .2s, transform .2s;
}

.submit-button:hover:not(:disabled) {
  background: #154a47;
  transform: translateY(-1px);
}

.submit-button:disabled {
  cursor: wait;
  opacity: .65;
}

.signup-hint {
  margin: 2rem 0 0;
  color: #8a9490;
  text-align: center;
  font-size: .8rem;
}

.copyright {
  position: absolute;
  bottom: 1.5rem;
  color: #9ba5a0;
  font-size: .7rem;
}

.login-page {
  background: transparent;
  color: var(--space-text);
}

.welcome-panel {
  background: linear-gradient(145deg, rgba(7, 25, 48, .92), rgba(12, 53, 86, .68));
  border-right: 1px solid var(--space-line);
  backdrop-filter: blur(10px);
}

.brand-mark {
  color: #102846;
  background: var(--space-gold);
}

.eyebrow,
.form-kicker,
h1 em {
  color: var(--space-gold);
}

.welcome-copy,
.form-intro,
.remember-row,
.copyright,
.signup-hint {
  color: var(--space-muted);
}

.form-panel {
  background: rgba(5, 16, 31, .44);
  backdrop-filter: blur(14px);
}

h2 {
  color: var(--space-text);
}

.field-label {
  color: #c3d5e7;
}

.input-shell {
  border-color: var(--space-line);
  background: rgba(13, 38, 67, .72);
}

.input-shell:focus-within {
  border-color: #6aa8dc;
  box-shadow: 0 0 0 3px rgba(106, 168, 220, .14);
}

.input-shell>ion-icon,
.icon-button {
  color: #91b3d2;
}

input:not([type='checkbox']) {
  color: var(--space-text);
}

input::placeholder {
  color: #7894af;
}

input[type='checkbox'] {
  accent-color: var(--space-gold);
}

.submit-button {
  color: #091728;
  background: var(--space-gold);
}

.submit-button:hover:not(:disabled) {
  background: #ffd98e;
}

@media (max-width: 700px) {
  .login-page {
    display: block;
  }

  .welcome-panel {
    display: none;
  }

  .form-panel {
    min-height: 100vh;
    padding: 2rem 1.5rem;
    align-items: start;
  }

  .mobile-brand {
    display: flex;
    margin-bottom: 5rem;
  }

  .form-kicker {
    margin-top: 0;
  }

  .copyright {
    position: static;
    margin-top: 4rem;
    text-align: center;
  }
}
</style>
