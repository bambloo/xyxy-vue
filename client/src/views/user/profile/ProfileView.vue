<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const statusMessage = ref('')
const { t } = useI18n()

const user = reactive({
  account: 'admin',
  name: '管理员',
  phone: '13800000000',
  email: 'admin@bambloo.com',
  birthday: '1990-01-01',
  hobbies: '读书、旅行、技术',
})

function saveProfile() {
  statusMessage.value = t('profile.saved')
}
</script>

<template>
  <section class="panel">
    <div class="section-head">
      <div>
        <p class="eyebrow">{{ t('profile.eyebrow') }}</p>
        <h2>{{ t('profile.title') }}</h2>
      </div>
      <button class="primary-button" type="button" @click="saveProfile">{{ t('profile.save') }}</button>
    </div>

    <div v-if="statusMessage" class="status-banner" role="status">
      {{ statusMessage }}
    </div>

    <div class="field-grid">
      <label>
        <span>{{ t('common.account') }}</span>
        <input v-model="user.account" type="text" readonly />
      </label>
      <label>
        <span>{{ t('profile.username') }}</span>
        <input v-model="user.name" type="text" />
      </label>
      <label>
        <span>{{ t('common.phone') }}</span>
        <input v-model="user.phone" type="tel" />
      </label>
      <label>
        <span>{{ t('profile.email') }}</span>
        <input v-model="user.email" type="email" />
      </label>
      <label>
        <span>{{ t('profile.birthday') }}</span>
        <input v-model="user.birthday" type="date" />
      </label>
      <label class="full-width">
        <span>{{ t('profile.hobbies') }}</span>
        <textarea v-model="user.hobbies" rows="4" />
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
  box-shadow: 0 14px 30px rgba(0, 0, 0, .16);
  backdrop-filter: blur(16px);
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

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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

input,
textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--space-line);
  border-radius: 10px;
  padding: 0.8rem 0.85rem;
  font: inherit;
  background: rgba(13, 38, 67, .72);
  color: var(--space-text);
}

input[readonly] {
  background: rgba(5, 18, 36, .62);
  color: var(--space-muted);
}

textarea {
  resize: vertical;
}

.full-width {
  grid-column: 1 / -1;
}

@media (max-width: 860px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
