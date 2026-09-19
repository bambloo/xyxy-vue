<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const statusMessage = ref('')
const { t } = useI18n()

const securitySettings = reactive({
  twoFactor: true,
  loginAlert: true,
  sessionTimeout: '30',
})

function saveSecurity() {
  statusMessage.value = t('security.updated')
}
</script>

<template>
  <section class="panel">
    <div class="section-head">
      <div>
        <p class="eyebrow">{{ t('security.eyebrow') }}</p>
        <h2>{{ t('security.title') }}</h2>
      </div>
      <button class="primary-button" type="button" @click="saveSecurity">{{ t('security.save') }}</button>
    </div>

    <div v-if="statusMessage" class="status-banner" role="status">
      {{ statusMessage }}
    </div>

    <div class="switch-list">
      <label class="switch-row">
        <span>{{ t('security.twoFactor') }}</span>
        <input v-model="securitySettings.twoFactor" type="checkbox" />
      </label>
      <label class="switch-row">
        <span>{{ t('security.loginAlert') }}</span>
        <input v-model="securitySettings.loginAlert" type="checkbox" />
      </label>
      <label>
        <span>{{ t('security.timeout') }}</span>
        <select v-model="securitySettings.sessionTimeout">
          <option value="15">{{ t('security.minutes15') }}</option>
          <option value="30">{{ t('security.minutes30') }}</option>
          <option value="60">{{ t('security.minutes60') }}</option>
        </select>
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

.switch-list {
  display: grid;
  gap: 1rem;
}

.switch-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.8rem 0.2rem;
  border-bottom: 1px solid rgba(36, 67, 65, 0.08);
}

.switch-row input {
  width: 1.2rem;
  height: 1.2rem;
  accent-color: var(--space-gold);
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  color: #c3d5e7;
  font-size: 0.85rem;
  font-weight: 600;
}

select {
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
