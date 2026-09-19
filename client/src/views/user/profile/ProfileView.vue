<script setup lang="ts">
import { reactive, ref } from 'vue'

const statusMessage = ref('')

const user = reactive({
  account: 'admin',
  name: '管理员',
  phone: '13800000000',
  email: 'admin@bambloo.com',
  birthday: '1990-01-01',
  hobbies: '读书、旅行、技术',
})

function saveProfile() {
  statusMessage.value = '个人信息已保存'
}
</script>

<template>
  <section class="panel">
    <div class="section-head">
      <div>
        <p class="eyebrow">基础信息</p>
        <h2>个人资料</h2>
      </div>
      <button class="primary-button" type="button" @click="saveProfile">保存资料</button>
    </div>

    <div v-if="statusMessage" class="status-banner" role="status">
      {{ statusMessage }}
    </div>

    <div class="field-grid">
      <label>
        <span>账号</span>
        <input v-model="user.account" type="text" readonly />
      </label>
      <label>
        <span>用户名</span>
        <input v-model="user.name" type="text" />
      </label>
      <label>
        <span>手机号</span>
        <input v-model="user.phone" type="tel" />
      </label>
      <label>
        <span>邮箱</span>
        <input v-model="user.email" type="email" />
      </label>
      <label>
        <span>生日</span>
        <input v-model="user.birthday" type="date" />
      </label>
      <label class="full-width">
        <span>兴趣爱好</span>
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
