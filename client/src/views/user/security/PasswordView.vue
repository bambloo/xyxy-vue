<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { hash_password } from '../../../../../common/util/crypto'
import { post } from '../../../scripts/request'

const statusMessage = ref('')
const loading = ref(false)
const { t } = useI18n()

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

async function changePassword() {
  if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
    statusMessage.value = t('password.required')
    return
  }

  if (
    passwordForm.newPassword.length < 8 ||
    !/[A-Za-z]/.test(passwordForm.newPassword) ||
    !/\d/.test(passwordForm.newPassword)
  ) {
    statusMessage.value = t('password.format')
    return
  }

  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    statusMessage.value = t('password.mismatch')
    return
  }

  try {
    const [currentPasswordHash, newPasswordHash] = await Promise.all([
      hash_password(passwordForm.currentPassword),
      hash_password(passwordForm.newPassword),
    ])
    await post('/wpi/user/password', loading, { currentPasswordHash, newPasswordHash })
    statusMessage.value = t('password.updated')
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
  } catch (error) {
    const message = error as { msg?: string }
    statusMessage.value = message.msg || t('password.failed')
  }
}
</script>

<template>
  <section class="panel">
    <div class="section-head">
      <div>
        <p class="eyebrow">{{ t('password.eyebrow') }}</p>
        <h2>{{ t('password.title') }}</h2>
      </div>
      <button class="primary-button" type="button" :disabled="loading" @click="changePassword">{{ t('password.update')
        }}</button>
    </div>

    <div v-if="statusMessage" class="status-banner" role="status">
      {{ statusMessage }}
    </div>

    <div class="field-stack">
      <label>
        <span>{{ t('password.current') }}</span>
        <input v-model="passwordForm.currentPassword" type="password" :placeholder="t('password.currentPlaceholder')" />
      </label>
      <label>
        <span>{{ t('password.new') }}</span>
        <input v-model="passwordForm.newPassword" type="password" :placeholder="t('password.newPlaceholder')" />
      </label>
      <label>
        <span>{{ t('password.confirm') }}</span>
        <input v-model="passwordForm.confirmPassword" type="password" :placeholder="t('password.confirmPlaceholder')" />
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
