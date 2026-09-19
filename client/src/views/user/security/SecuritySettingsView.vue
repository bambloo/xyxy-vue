<script setup lang="ts">
import { reactive, ref } from 'vue'

const statusMessage = ref('')

const securitySettings = reactive({
  twoFactor: true,
  loginAlert: true,
  sessionTimeout: '30 分钟',
})

function saveSecurity() {
  statusMessage.value = '安全设置已更新'
}
</script>

<template>
  <section class="panel">
    <div class="section-head">
      <div>
        <p class="eyebrow">安全设置</p>
        <h2>登录保护</h2>
      </div>
      <button class="primary-button" type="button" @click="saveSecurity">保存设置</button>
    </div>

    <div v-if="statusMessage" class="status-banner" role="status">
      {{ statusMessage }}
    </div>

    <div class="switch-list">
      <label class="switch-row">
        <span>双因素认证</span>
        <input v-model="securitySettings.twoFactor" type="checkbox" />
      </label>
      <label class="switch-row">
        <span>登录异常提醒</span>
        <input v-model="securitySettings.loginAlert" type="checkbox" />
      </label>
      <label>
        <span>会话超时</span>
        <select v-model="securitySettings.sessionTimeout">
          <option value="15 分钟">15 分钟</option>
          <option value="30 分钟">30 分钟</option>
          <option value="60 分钟">60 分钟</option>
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
