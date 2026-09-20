<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { post } from '@/scripts/request'
import { useAuthStore } from '@/stores/auth'
import TagUserView from '@/views/TagUserView.vue'

type TagState = 'loading' | 'missing' | 'inactive' | 'active'
type AppState = 'loading' | 'ready' | 'empty'

const route = useRoute()
const auth = useAuthStore()
const isHomeRoute = computed(() => route.name === 'home')
const tag = computed(() => {
  const routeTag = route.params.tag
  if (Array.isArray(routeTag)) return routeTag.join('/')
  return typeof routeTag === 'string' ? routeTag : undefined
})
const isLoginRoute = computed(() => route.name === 'login')
const isTagRoute = computed(() => route.name === 'tag' && Boolean(tag.value))
const tagState = ref<TagState>('loading')
const tagLoading = ref(false)
const appState = ref<AppState>('loading')

async function loadTagState() {
  if (isLoginRoute.value) {
    appState.value = 'ready'
    return
  }

  if (!isTagRoute.value || !tag.value) {
    tagState.value = 'loading'
    if (isHomeRoute.value) {
      appState.value = 'ready'
      return
    }
    appState.value = 'loading'
    try {
      await auth.hydrate()
      appState.value = auth.isLoggedIn ? 'ready' : 'empty'
    } catch {
      appState.value = 'empty'
    }
    return
  }

  appState.value = 'ready'
  try {
    const packet = await post('/wpi/user/tag', tagLoading, { tag: tag.value })
    const isActive = (packet.data as { isActive?: boolean } | undefined)?.isActive === true
    tagState.value = isActive ? 'active' : 'inactive'
  } catch {
    tagState.value = 'missing'
  }
}

watch([isLoginRoute, isHomeRoute, isTagRoute, tag], loadTagState, { immediate: true })
</script>

<template>
  <div class="app-shell">
    <template v-if="isTagRoute">
      <TagUserView v-if="tagState === 'inactive' || tagState === 'active'" :key="`${tag}-${tagState}`" :tag="tag!"
        :active="tagState === 'active'" />
      <div v-else class="empty-page" aria-hidden="true"></div>
    </template>
    <RouterView v-else-if="appState === 'ready'" />
    <div v-else class="empty-page" aria-hidden="true"></div>
  </div>
</template>

<style>
:root {
  --space-ink: #071426;
  --space-blue: #102846;
  --space-panel: rgba(10, 29, 53, .78);
  --space-panel-soft: rgba(19, 45, 77, .64);
  --space-line: rgba(166, 202, 239, .18);
  --space-text: #e8f1fb;
  --space-muted: #9db4cb;
  --space-gold: #f0bd63;
}

html,
body,
#app {
  min-height: 100%;
  margin: 0;
}

body {
  background: var(--space-ink);
}

.app-shell {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(circle at 78% 12%, rgba(44, 103, 166, .26), transparent 28rem),
    radial-gradient(circle at 12% 84%, rgba(26, 78, 132, .2), transparent 25rem),
    linear-gradient(135deg, #061020 0%, #0a1b34 52%, #081426 100%);
  color: var(--space-text);
}

.empty-page {
  min-height: 100vh;
}
</style>
