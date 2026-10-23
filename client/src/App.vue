<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { post } from '@/scripts/request'
import { useAuthStore } from '@/stores/auth'
import TagUserView from '@/views/TagUserView.vue'
import SunPortalButton from '@/components/SunPortalButton.vue'
import TimeFortuneDialog from '@/components/TimeFortuneDialog.vue'
import GalaxyStarComposer from '@/components/GalaxyStarComposer.vue'
import { GALAXY_CAMERA_CENTER_EVENT, GALAXY_CAMERA_ZOOM_OUT_EVENT } from '@/events/galaxy-camera'
import {
  GALAXY_STAR_COMMENT_OPEN_EVENT,
  GALAXY_STAR_COMMENT_QUEUE_EVENT,
} from '@/events/galaxy-star'
import { TIME_FORTUNE_HISTORY_EVENT, TIME_FORTUNE_TOGGLE_EVENT } from '@/events/time-fortune'

type TagState = 'loading' | 'missing' | 'inactive' | 'active'
type AppState = 'loading' | 'ready' | 'empty'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const isGalaxyRoute = computed(() => route.name === 'galaxy')
const isPortalRoute = computed(() => isGalaxyRoute.value)
const canShowPortalButton = computed(
  () => isPortalRoute.value && auth.isSessionValidated && Boolean(auth.currentUser?.tag),
)
const queuedCommentStarCount = ref(0)
const portalLabel = computed(() =>
  queuedCommentStarCount.value > 0
    ? `有 ${queuedCommentStarCount.value} 颗星星收到新评论，点击查看；上划回到星系中心，下划拉远镜头`
    : '上划回到星系中心，下划拉远镜头；点击查看星言星语',
)
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

watch(
  isGalaxyRoute,
  (isGalaxy) => {
    document.documentElement.classList.toggle('galaxy-no-scroll', isGalaxy)
    document.body.classList.toggle('galaxy-no-scroll', isGalaxy)
  },
  { immediate: true },
)

async function loadTagState() {
  if (isLoginRoute.value) {
    appState.value = 'ready'
    return
  }

  if (!isTagRoute.value || !tag.value) {
    tagState.value = 'loading'
    if (isGalaxyRoute.value) {
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
    await router.replace({ name: 'galaxy' })
  }
}

watch([isLoginRoute, isGalaxyRoute, isTagRoute, tag], loadTagState, {
  immediate: true,
})

function handleFortuneSwipe() {
  if (isGalaxyRoute.value) window.dispatchEvent(new Event(TIME_FORTUNE_TOGGLE_EVENT))
}

function handleCameraZoomOut() {
  if (isGalaxyRoute.value) window.dispatchEvent(new Event(GALAXY_CAMERA_ZOOM_OUT_EVENT))
}

function handleCameraCenter() {
  if (isGalaxyRoute.value) window.dispatchEvent(new Event(GALAXY_CAMERA_CENTER_EVENT))
}

function handleFortuneActivate() {
  if (!isGalaxyRoute.value) return
  if (queuedCommentStarCount.value > 0) {
    window.dispatchEvent(new Event(GALAXY_STAR_COMMENT_OPEN_EVENT))
    return
  }
  window.dispatchEvent(new Event(TIME_FORTUNE_HISTORY_EVENT))
}

function handleCommentQueueChange(event: Event) {
  const count = (event as CustomEvent<number>).detail
  queuedCommentStarCount.value = Number.isInteger(count) && count > 0 ? count : 0
}

onMounted(() => {
  window.addEventListener(GALAXY_STAR_COMMENT_QUEUE_EVENT, handleCommentQueueChange)
})

onBeforeUnmount(() => {
  window.removeEventListener(GALAXY_STAR_COMMENT_QUEUE_EVENT, handleCommentQueueChange)
  document.documentElement.classList.remove('galaxy-no-scroll')
  document.body.classList.remove('galaxy-no-scroll')
})
</script>

<template>
  <div class="app-shell">
    <template v-if="isTagRoute">
      <TagUserView
        v-if="tagState === 'inactive' || tagState === 'active'"
        :key="`${tag}-${tagState}`"
        :tag="tag!"
        :active="tagState === 'active'"
      />
      <div v-else class="empty-page" aria-hidden="true"></div>
    </template>
    <RouterView v-else-if="appState === 'ready'" v-slot="{ Component }">
      <Transition :name="isPortalRoute ? 'portal-route' : 'route-instant'">
        <component :is="Component" :key="route.name" />
      </Transition>
    </RouterView>
    <div v-else class="empty-page" aria-hidden="true"></div>
    <TimeFortuneDialog />
    <GalaxyStarComposer />
    <Teleport to="body">
      <SunPortalButton
        v-if="canShowPortalButton"
        class="sun-portal-control"
        :label="portalLabel"
        :title="portalLabel"
        :notification="queuedCommentStarCount > 0"
        @swipe-up="handleCameraCenter"
        @swipe-down="handleCameraZoomOut"
        @swipe-left="handleFortuneSwipe"
        @swipe-right="handleFortuneSwipe"
        @activate="handleFortuneActivate"
      />
    </Teleport>
  </div>
</template>

<style>
:root {
  --space-ink: #071426;
  --space-blue: #102846;
  --space-panel: rgba(10, 29, 53, 0.78);
  --space-panel-soft: rgba(19, 45, 77, 0.64);
  --space-line: rgba(166, 202, 239, 0.18);
  --space-text: #e8f1fb;
  --space-muted: #9db4cb;
  --space-gold: #f0bd63;
}

html,
body,
#app {
  height: 100%;
  min-height: 100%;
  margin: 0;
}

html.galaxy-no-scroll,
body.galaxy-no-scroll,
body.galaxy-no-scroll #app {
  overflow: hidden;
}

body {
  background: var(--space-ink);
}

.app-shell {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(circle at 78% 12%, rgba(44, 103, 166, 0.26), transparent 28rem),
    radial-gradient(circle at 12% 84%, rgba(26, 78, 132, 0.2), transparent 25rem),
    linear-gradient(135deg, #061020 0%, #0a1b34 52%, #081426 100%);
  color: var(--space-text);
}

.app-shell:has(.galaxy-demo) {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.empty-page {
  min-height: 100vh;
}

.sun-portal-control {
  position: fixed;
  z-index: 1000;
  left: 50%;
  bottom: clamp(112px, 13vh, 168px);
  transform: translateX(-50%);
}

body.star-dialog-open .sun-portal-control {
  pointer-events: none;
}

.portal-route-enter-active,
.portal-route-leave-active {
  position: absolute;
  inset: 0;
  width: 100%;
  transition:
    opacity 420ms ease,
    transform 420ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.portal-route-enter-from {
  opacity: 0;
  transform: scale(0.985);
}

.portal-route-leave-to {
  opacity: 0;
  transform: scale(1.015);
}

@media (prefers-reduced-motion: reduce) {
  .portal-route-enter-active,
  .portal-route-leave-active {
    transition: none;
  }
}
</style>
