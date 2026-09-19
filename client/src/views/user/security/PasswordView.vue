<script setup lang="ts">
import { reactive, ref } from 'vue'

const statusMessage = ref('')

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

function changePassword() {
  if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
    statusMessage.value = '请完整填写密码信息'
    return
  }

  if (
    passwordForm.newPassword.length < 8 ||
    !/[A-Za-z]/.test(passwordForm.newPassword) ||
    !/\d/.test(passwordForm.newPassword)
  ) {
    statusMessage.value = '新密码需为 8-20 位，且包含字母和数字'
    return
  }

  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    statusMessage.value = '两次输入的新密码不一致'
    return
  }

  statusMessage.value = '密码已更新'
  passwordForm.currentPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
}
</script>

<template>
  <section class="panel">
    <div class="section-head">
      <div>
        <p class="eyebrow">账户安全</p>
        <h2>修改密码</h2>
      </div>
      <button class="primary-button" type="button" @click="changePassword">更新密码</button>
    </div>

    <div v-if="statusMessage" class="status-banner" role="status">
      {{ statusMessage }}
    </div>

    <div class="field-stack">
      <label>
        <span>当前密码</span>
        <input v-model="passwordForm.currentPassword" type="password" placeholder="请输入当前密码" />
      </label>
      <label>
        <span>新密码</span>
        <input v-model="passwordForm.newPassword" type="password" placeholder="请输入新密码" />
      </label>
      <label>
        <span>确认新密码</span>
        <input v-model="passwordForm.confirmPassword" type="password" placeholder="请再次输入新密码" />
      </label>
    </div>
  </section>
</template>

<style scoped lang="scss">
.panel {
  padding: 1.5rem;
  border: 1px solid var(--space-line);
  border-radius: 20px;
  background: var(--space-panel);
  backdrop-filter: blur(16px);
  box-shadow: 0 14px 30px rgba(23, 34, 34, 0.04);
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

.field-stack {
  display: grid;
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

input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--space-line);
  border-radius: 10px;
  padding: 0.8rem 0.85rem;
  font: inherit;
  background: rgba(13, 38, 67, .72);
  color: var(--space-text);
}
</style>
