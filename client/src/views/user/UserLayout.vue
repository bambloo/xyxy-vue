<script setup lang="ts">
import { computed } from 'vue'

type TabKey = 'profile' | 'password' | 'security' | 'preferences'

const props = defineProps<{
  currentTab?: TabKey
}>()

const emit = defineEmits<{
  (event: 'tab-change', value: TabKey): void
}>()

const tabs: Array<{ key: TabKey; label: string; icon: string; description: string }> = [
  { key: 'profile', label: '个人信息', icon: 'person-outline', description: '基本资料' },
  { key: 'password', label: '修改密码', icon: 'lock-closed-outline', description: '账户安全' },
  { key: 'security', label: '安全设置', icon: 'shield-checkmark-outline', description: '登录保护' },
  { key: 'preferences', label: '其他设置', icon: 'settings-outline', description: '偏好与扩展' },
]

const activeTab = computed(() => props.currentTab ?? 'profile')

function setTab(tab: TabKey) {
  emit('tab-change', tab)
}
</script>

<template>
  <main class="user-management-page">
    <aside class="sidebar">
      <div class="brand-wrap">
        <div class="brand-mark">B</div>
        <div>
          <p class="brand-name">Bambloo</p>
          <small>用户中心</small>
        </div>
      </div>

      <nav class="side-nav" aria-label="用户管理导航">
        <button v-for="tab in tabs" :key="tab.key" type="button"
          :class="['nav-item', { active: activeTab === tab.key }]" @click="setTab(tab.key)">
          <ion-icon :name="tab.icon"></ion-icon>
          <span>
            <strong>{{ tab.label }}</strong>
            <small>{{ tab.description }}</small>
          </span>
        </button>
      </nav>
    </aside>

    <section class="content-panel">
      <header class="topbar">
        <div>
          <p class="eyebrow">账户管理</p>
          <h1>用户信息管理</h1>
        </div>
        <button class="ghost-button" type="button">退出登录</button>
      </header>

      <slot />
    </section>
  </main>
</template>

<style scoped lang="scss">
:global(body) {
  margin: 0;
  background: #f4f3ee;
}

.user-management-page {
  display: grid;
  grid-template-columns: 290px minmax(0, 1fr);
  min-height: 100vh;
  background: linear-gradient(135deg, #f6f3ee, #edf3f2);
  color: #172222;
  font-family: 'DM Sans', sans-serif;
}

.sidebar {
  padding: 2rem 1.25rem;
  background: rgba(21, 63, 61, 0.96);
  color: #f7f1e7;
}

.brand-wrap {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-bottom: 2rem;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 2.7rem;
  height: 2.7rem;
  border-radius: 50%;
  background: #e9b45e;
  color: #153f3d;
  font-weight: 700;
}

.brand-name {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
}

.brand-wrap small {
  color: rgba(255, 255, 255, 0.7);
}

.side-nav {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  width: 100%;
  padding: 0.85rem 0.9rem;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-item ion-icon {
  font-size: 1.15rem;
}

.nav-item span {
  display: flex;
  flex-direction: column;
}

.nav-item small {
  color: rgba(255, 255, 255, 0.7);
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 0 0 1px rgba(233, 180, 94, 0.35);
}

.content-panel {
  padding: clamp(1.5rem, 3vw, 2.5rem);
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.eyebrow {
  margin: 0 0 0.4rem;
  color: #d28f2d;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  letter-spacing: -0.04em;
  font-size: clamp(2rem, 3vw, 2.6rem);
}

.ghost-button {
  border: 0;
  border-radius: 10px;
  padding: 0.75rem 1.1rem;
  background: rgba(21, 63, 61, 0.08);
  color: #153f3d;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

@media (max-width: 860px) {
  .user-management-page {
    grid-template-columns: 1fr;
  }

  .sidebar {
    padding-bottom: 1rem;
  }
}
</style>
