<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { post } from '../scripts/request'

const router = useRouter()
const account = ref('')
const password = ref('')
const rememberMe = ref(true)
const showPassword = ref(false)
const loading = ref(false)
const errorMessage = ref('')

async function submitLogin() {
  errorMessage.value = ''

  if (!account.value.trim() || !password.value) {
    errorMessage.value = '请输入账号和密码'
    return
  }

  try {
    await post('/user/login', loading, {
      account: account.value.trim(),
      password: password.value,
      remember: rememberMe.value,
    })
    await router.push('/')
  } catch (error: unknown) {
    const response = error as { msg?: string; message?: string }
    errorMessage.value = response.msg || response.message || '登录失败，请检查账号或密码'
  }
}
</script>

<template>
  <main class="login-page">
    <section class="welcome-panel" aria-label="产品介绍">
      <div class="brand-mark">B</div>
      <p class="eyebrow">WELCOME BACK</p>
      <h1>让每一次工作，<br /><em>从容开始。</em></h1>
      <div class="orb orb-one"></div>
      <div class="orb orb-two"></div>
      <div class="line-pattern"></div>
    </section>

    <section class="form-panel">
      <div class="form-wrap">
        <div class="mobile-brand"><span class="brand-mark">B</span> Bambloo</div>
        <p class="form-kicker">账户登录</p>
        <h2>欢迎回来</h2>
        <p class="form-intro">请输入你的账户信息以继续</p>

        <form class="login-form" @submit.prevent="submitLogin">
          <label class="field-label" for="account">账号</label>
          <div class="input-shell">
            <ion-icon name="person-outline"></ion-icon>
            <input id="account" v-model="account" type="text" autocomplete="username" placeholder="请输入账号或手机号" />
          </div>

          <div class="password-heading">
            <label class="field-label" for="password">密码</label>
            <a href="#" @click.prevent="errorMessage = '请联系管理员重置密码'">忘记密码？</a>
          </div>
          <div class="input-shell">
            <ion-icon name="lock-closed-outline"></ion-icon>
            <input id="password" v-model="password" :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password" placeholder="请输入密码" />
            <button class="icon-button" type="button" :aria-label="showPassword ? '隐藏密码' : '显示密码'"
              @click="showPassword = !showPassword">
              <ion-icon :name="showPassword ? 'eye-off-outline' : 'eye-outline'"></ion-icon>
            </button>
          </div>

          <label class="remember-row">
            <input v-model="rememberMe" type="checkbox" />
            <span>记住我</span>
          </label>

          <p v-if="errorMessage" class="error-message" role="alert">
            <ion-icon name="alert-circle-outline"></ion-icon>{{ errorMessage }}
          </p>
          <button class="submit-button" type="submit" :disabled="loading">
            <span>{{ loading ? '正在登录...' : '登录' }}</span>
            <ion-icon v-if="!loading" name="arrow-forward-outline"></ion-icon>
          </button>
        </form>

        <p class="signup-hint">还没有账户？ <a href="#" @click.prevent="errorMessage = '注册功能即将开放'">立即注册</a></p>
      </div>
      <p class="copyright">© 2026 Bambloo · 让协作更简单</p>
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

.error-message {
  display: flex;
  align-items: center;
  gap: .45rem;
  margin: -1rem 0 1rem;
  color: #bb4b43;
  font-size: .78rem;
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
