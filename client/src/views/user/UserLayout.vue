<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { toggleLocale } from '../../i18n'
import { useI18n } from 'vue-i18n'

type TabKey = 'profile' | 'password' | 'security' | 'users'

type TabConfig = {
  key: TabKey
  labelKey: string
  icon: string
  descriptionKey: string
  route: string
}

const props = defineProps<{
  currentTab?: TabKey
}>()

const router = useRouter()
const auth = useAuthStore()
const { t } = useI18n()

const tabs: TabConfig[] = [
  { key: 'profile', labelKey: 'user.profile', icon: 'person-outline', descriptionKey: 'user.profileHint', route: 'user-profile' },
  { key: 'password', labelKey: 'user.password', icon: 'lock-closed-outline', descriptionKey: 'user.passwordHint', route: 'user-password' },
  { key: 'security', labelKey: 'user.security', icon: 'shield-checkmark-outline', descriptionKey: 'user.securityHint', route: 'user-security' },
  { key: 'users', labelKey: 'user.users', icon: 'people-outline', descriptionKey: 'user.usersHint', route: 'user-users' },
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
          <small>{{ t('user.center') }}</small>
        </div>
      </div>

      <nav class="side-nav" :aria-label="t('user.management')">
        <button v-for="tab in tabs" :key="tab.key" type="button"
          :class="['nav-item', { active: activeTab === tab.key }]" @click="goToTab(tab)">
          <ion-icon :name="tab.icon"></ion-icon>
          <span>
            <strong>{{ t(tab.labelKey) }}</strong>
            <small>{{ t(tab.descriptionKey) }}</small>
          </span>
        </button>
      </nav>
    </aside>

    <section class="content-panel">
      <header class="topbar">
        <div>
          <p class="eyebrow">{{ t('user.managementKicker') }}</p>
          <h1>{{ t('user.management') }}</h1>
        </div>
        <div class="topbar-actions">
          <button class="locale-button" type="button" @click="toggleLocale">{{ t('common.language') }}</button>
          <button class="ghost-button" type="button" @click="logout">{{ t('common.logout') }}</button>
        </div>
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

.topbar-actions {
  display: flex;
  align-items: center;
  gap: .65rem;
}

.locale-button {
  border: 1px solid var(--space-line);
  border-radius: 999px;
  padding: .45rem .7rem;
  background: rgba(110, 164, 214, .1);
  color: var(--space-muted);
  font: inherit;
  font-size: .72rem;
  cursor: pointer;
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
