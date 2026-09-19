<script setup lang="ts">
import { reactive, ref } from 'vue'

const statusMessage = ref('')

const preferences = reactive({
  theme: '浅色',
  notify: true,
  compactMode: false,
})

function savePreferencesSettings() {
  statusMessage.value = '偏好设置已保存'
}
</script>

<template>
  <section class="panel">
    <div class="section-head">
      <div>
        <p class="eyebrow">功能扩展</p>
        <h2>其他设置</h2>
      </div>
      <button class="primary-button" type="button" @click="savePreferencesSettings">保存偏好</button>
    </div>

    <div v-if="statusMessage" class="status-banner" role="status">
      {{ statusMessage }}
    </div>

    <div class="switch-list">
      <label class="switch-row">
        <span>消息通知</span>
        <input v-model="preferences.notify" type="checkbox" />
      </label>
      <label class="switch-row">
        <span>紧凑模式</span>
        <input v-model="preferences.compactMode" type="checkbox" />
      </label>
      <label>
        <span>界面主题</span>
        <select v-model="preferences.theme">
          <option value="浅色">浅色</option>
          <option value="深色">深色</option>
          <option value="自动">自动</option>
        </select>
      </label>
    </div>
  </section>
</template>

<style scoped lang="scss">
.panel {
  padding: 1.5rem;
  border: 1px solid rgba(27, 92, 88, 0.08);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.7);
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
  color: #d28f2d;
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
  background: #1d5d59;
  color: white;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.status-banner {
  margin-bottom: 1rem;
  padding: 0.9rem 1rem;
  border-radius: 12px;
  background: rgba(35, 122, 114, 0.1);
  color: #184f4d;
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
  accent-color: #237a72;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  color: #334341;
  font-size: 0.85rem;
  font-weight: 600;
}

select {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #d7ddd8;
  border-radius: 10px;
  padding: 0.8rem 0.85rem;
  font: inherit;
  background: white;
  color: #172222;
}
</style>
