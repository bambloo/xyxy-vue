<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

type TabKey = 'profile' | 'password' | 'security' | 'users'

type TabConfig = {
  key: TabKey
  label: string
  icon: string
  description: string
  route: string
}

const props = defineProps<{
  currentTab?: TabKey
}>()

const router = useRouter()
const auth = useAuthStore()

const tabs: TabConfig[] = [
  { key: 'profile', label: '个人信息', icon: 'person-outline', description: '基本资料', route: 'user-profile' },
  { key: 'password', label: '修改密码', icon: 'lock-closed-outline', description: '账户安全', route: 'user-password' },
  { key: 'security', label: '安全设置', icon: 'shield-checkmark-outline', description: '登录保护', route: 'user-security' },
  { key: 'users', label: '用户列表', icon: 'people-outline', description: '导入待激活用户', route: 'user-users' },
]

const activeTab = computed(() => props.currentTab ?? 'profile')

function goToTab(tab: TabConfig) {
  router.push({ name: tab.route })
}

async function logout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <main class="user-management-page">
    <aside class="sidebar">
      <div class="brand-wrap">
        <div class="brand-mark">B</div>
        <div>
          <p class="brand-name">星语心愿</p>
          <small>用户中心</small>
        </div>
      </div>

      <nav class="side-nav" aria-label="用户管理导航">
        <button v-for="tab in tabs" :key="tab.key" type="button"
          :class="['nav-item', { active: activeTab === tab.key }]" @click="goToTab(tab)">
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
        <button class="ghost-button" type="button" @click="logout">退出登录</button>
      </header>

      <slot />
    </section>
  </main>
</template>

<style scoped lang="scss">
:global(body) {
  margin: 0;
  background: var(--space-ink);
}

.user-management-page {
  display: grid;
  grid-template-columns: 290px minmax(0, 1fr);
  min-height: 100vh;
  background: linear-gradient(135deg, rgba(6, 16, 32, .72), rgba(12, 35, 63, .58));
  color: var(--space-text);
  font-family: 'DM Sans', sans-serif;
}

.sidebar {
  padding: 2rem 1.25rem;
  border-right: 1px solid var(--space-line);
  background: rgba(5, 18, 36, .82);
  color: var(--space-text);
  backdrop-filter: blur(18px);
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
  background: var(--space-gold);
  color: #102846;
  font-weight: 700;
}

.brand-name {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
}

.brand-wrap small {
  color: var(--space-muted);
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
  color: var(--space-muted);
}

.nav-item.active {
  background: rgba(91, 151, 211, .14);
  box-shadow: inset 0 0 0 1px rgba(240, 189, 99, .42);
}

.content-panel {
  padding: clamp(1.5rem, 3vw, 2.5rem);
  background: rgba(7, 20, 38, .3);
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
  color: var(--space-gold);
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
  border: 1px solid var(--space-line);
  border-radius: 10px;
  padding: 0.75rem 1.1rem;
  background: rgba(110, 164, 214, .1);
  color: var(--space-text);
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
