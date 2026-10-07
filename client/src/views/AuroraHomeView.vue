<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import SunPortalButton from '../components/SunPortalButton.vue'
import { MilkyWayBackground } from '../scripts/core/galaxy/MilkyWayBackground'

const router = useRouter()
const backgroundCanvas = ref<HTMLCanvasElement | null>(null)
const isEntering = ref(false)
let navigationTimer = 0
let milkyWayBackground: MilkyWayBackground | undefined

onMounted(() => {
  if (backgroundCanvas.value) milkyWayBackground = new MilkyWayBackground(backgroundCanvas.value)
})

function navigateToGalaxy() {
  if (navigationTimer) window.clearTimeout(navigationTimer)
  navigationTimer = 0
  void router.push({ name: 'galaxy' })
}

function enterGalaxy() {
  if (isEntering.value) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    navigateToGalaxy()
    return
  }
  isEntering.value = true
  navigationTimer = window.setTimeout(navigateToGalaxy, 1100)
}

function finishSunFlight(event: AnimationEvent) {
  if (!event.animationName.startsWith('sun-flight')) return
  navigateToGalaxy()
}

onBeforeUnmount(() => {
  if (navigationTimer) window.clearTimeout(navigationTimer)
  milkyWayBackground?.destroy()
})
</script>

<template>
  <main class="aurora-home" :class="{ 'aurora-home--entering': isEntering }" aria-label="极光主页">
    <canvas ref="backgroundCanvas" class="milky-way-background" aria-hidden="true"></canvas>
    <div class="aurora-shade" aria-hidden="true"></div>
    <SunPortalButton class="enter-galaxy" :disabled="isEntering" @swipe-up="enterGalaxy"
      @animationend="finishSunFlight" />
  </main>
</template>

<style scoped>
.aurora-home {
  position: relative;
  isolation: isolate;
  width: 100vw;
  height: 100dvh;
  min-height: 100vh;
  overflow: hidden;
  background-color: #030711;
}

.milky-way-background {
  position: absolute;
  z-index: 0;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.aurora-home::after {
  position: absolute;
  z-index: 2;
  inset: 0;
  background: radial-gradient(circle at center, #030711 0%, #02050d 52%, #01030a 100%);
  content: '';
  opacity: 0;
  pointer-events: none;
  transition: opacity 760ms ease 180ms;
}

.aurora-home--entering::after {
  opacity: 0.96;
}

.aurora-shade {
  position: absolute;
  z-index: 1;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(4, 10, 25, 0.12) 0%, transparent 42%, rgba(2, 8, 18, 0.44) 72%, #020813 100%),
    radial-gradient(ellipse at 50% 46%, transparent 28%, rgba(3, 11, 26, 0.2) 100%);
}

.enter-galaxy {
  --fireball-bottom: clamp(112px, 13vh, 168px);
  position: absolute;
  z-index: 3;
  left: 50%;
  bottom: var(--fireball-bottom);
  transform: translateX(-50%);
}

.aurora-home--entering .enter-galaxy {
  animation: sun-flight 900ms cubic-bezier(0.45, 0, 0.25, 1) forwards;
  pointer-events: none;
}

@keyframes sun-flight {
  0% {
    transform: translate(-50%, 0) scale(1);
    opacity: 1;
  }

  42% {
    transform: translate(-50%, calc(50% + var(--fireball-bottom) - 50vh)) scale(2.45);
    opacity: 1;
  }

  100% {
    transform: translate(-50%, calc(50% + var(--fireball-bottom) - 50vh)) scale(0.015);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .aurora-home::after {
    transition: none;
  }
}
</style>
