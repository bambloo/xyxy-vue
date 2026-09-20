<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { toggleLocale } from '../../i18n'
import { useI18n } from 'vue-i18n'
import { canAccessMenu, userMenuItems, type TabKey, type UserMenuItem } from './menu-config'

const props = defineProps<{
  currentTab?: TabKey
}>()

const router = useRouter()
const auth = useAuthStore()
const { t } = useI18n()
const isLandscape = () =>
  typeof window === 'undefined' || window.innerWidth >= window.innerHeight

const menuOpen = ref(isLandscape())
let previousLandscape = menuOpen.value

function syncSidebarState() {
  const landscape = isLandscape()
  menuOpen.value = landscape
  previousLandscape = landscape
}

function syncMenuWithOrientation() {
  const landscape = isLandscape()
  if (landscape !== previousLandscape) {
    syncSidebarState()
  }
}

function toggleSidebar() {
  menuOpen.value = !menuOpen.value
}

onMounted(() => {
  window.addEventListener('resize', syncMenuWithOrientation)
  window.addEventListener('orientationchange', syncMenuWithOrientation)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncMenuWithOrientation)
  window.removeEventListener('orientationchange', syncMenuWithOrientation)
})

const tabs = computed(() => userMenuItems.filter((tab) => canAccessMenu(auth.currentUser, tab)))

const activeTab = computed(() => props.currentTab ?? 'profile')

function goToTab(tab: UserMenuItem) {
  syncSidebarState()
  router.push({ name: tab.route })
}

watch(tabs, (availableTabs) => {
  if (!availableTabs.length) return
  if (!availableTabs.some((tab) => tab.key === activeTab.value)) {
    void router.replace({ name: availableTabs[0].route })
  }
}, { immediate: true })

async function logout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <main class="user-management-page">
    <header class="topbar">
      <div class="brand-wrap">
        <div class="brand-mark">B</div>
        <div>
          <p class="brand-name">星语心愿</p>
          <small>{{ t('user.center') }}</small>
        </div>
      </div>
      <div class="topbar-actions">
        <button class="locale-button" type="button" @click="toggleLocale">{{ t('common.language') }}</button>
        <button class="ghost-button" type="button" @click="logout">{{ t('common.logout') }}</button>
        <button class="menu-toggle" type="button" :aria-expanded="menuOpen" :aria-label="menuOpen ? '关闭菜单' : '打开菜单'"
          @click="toggleSidebar">
          <ion-icon :name="menuOpen ? 'close-outline' : 'menu-outline'"></ion-icon>
          <span>菜单</span>
        </button>
      </div>
    </header>

    <aside :class="['sidebar', { 'menu-open': menuOpen }]">
      <nav :class="['side-nav', { 'is-open': menuOpen }]" :aria-label="t('user.management')">
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
      <!-- <header class="page-heading">
        <p class="eyebrow">{{ t('user.managementKicker') }}</p>
        <h1>{{ t('user.management') }}</h1>
      </header> -->
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
  align-content: start;
  display: grid;
  grid-template-columns: 290px minmax(0, 1fr);
  grid-template-areas:
    'topbar topbar'
    'sidebar content';
  min-height: 100vh;
  background: linear-gradient(135deg, rgba(6, 16, 32, .72), rgba(12, 35, 63, .58));
  color: var(--space-text);
  font-family: 'DM Sans', sans-serif;
}

.topbar {
  grid-area: topbar;
}

.sidebar {
  grid-area: sidebar;
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
  flex-shrink: 0;
}

.menu-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-left: auto;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--space-line);
  border-radius: 10px;
  background: rgba(110, 164, 214, .1);
  color: var(--space-text);
  font: inherit;
  font-size: 0.78rem;
  cursor: pointer;
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

.sidebar:not(.menu-open) .side-nav {
  display: none;
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
  grid-area: content;
  padding: clamp(1.5rem, 3vw, 2.5rem);
  background: rgba(7, 20, 38, .3);
}

.page-heading {
  margin-bottom: 1rem;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 5.5rem;
  box-sizing: border-box;
  padding: 1rem clamp(1.25rem, 3vw, 2.5rem);
  margin-bottom: 1rem;
}

.topbar .brand-wrap {
  margin-right: 0;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: .65rem;
}

.locale-button,
.ghost-button,
.menu-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 2.75rem;
  box-sizing: border-box;
  line-height: 1;
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

@media (min-width: 861px) {
  .menu-toggle {
    display: none;
  }
}

@media (max-width: 860px) {
  .user-management-page {
    grid-template-columns: 1fr;
    grid-template-areas:
      'topbar'
      'sidebar'
      'content';
  }

  .topbar {
    flex-wrap: wrap;
    min-height: 0;
    padding: 1rem;
  }

  .topbar .brand-wrap {
    flex: 1 1 auto;
  }

  .topbar-actions {
    margin-left: auto;
  }

  .sidebar {
    position: sticky;
    top: 0;
    z-index: 2;
    padding: 1rem;
    border-right: 0;
    border-bottom: 1px solid var(--space-line);
  }

  .brand-wrap {
    margin-bottom: 0;
  }

  .menu-toggle {
    display: inline-flex;
    margin-left: 0;
  }

  .side-nav {
    display: none;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .side-nav.is-open {
    display: flex;
  }

  .nav-item {
    padding: 0.7rem 0.8rem;
  }

  .nav-item small {
    display: none;
  }

  .content-panel {
    padding: 1.25rem;
  }
}

@media (max-width: 520px) {
  .brand-wrap {
    gap: 0.65rem;
  }

  .brand-mark {
    width: 2.35rem;
    height: 2.35rem;
  }

  .nav-item {
    justify-content: flex-start;
  }

  .topbar {
    align-items: stretch;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
  }

  .topbar-actions {
    width: 100%;
    flex-direction: row;
    align-items: center;
    gap: 0.4rem;
  }

  .locale-button,
  .ghost-button,
  .menu-toggle {
    flex: 1;
    padding: 0.55rem 0.7rem;
    font-size: 0.78rem;
    white-space: nowrap;
    justify-content: center;
  }

  .content-panel {
    padding: 1rem;
  }
}
</style>
