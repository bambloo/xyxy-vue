<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { SunFlareEffect } from '../scripts/core/galaxy/SunFlareEffect'

const router = useRouter()
const particleCanvas = ref<HTMLCanvasElement | null>(null)
const isEntering = ref(false)
let navigationTimer = 0
let sunFlareEffect: SunFlareEffect | undefined

onMounted(() => {
  if (particleCanvas.value) sunFlareEffect = new SunFlareEffect(particleCanvas.value)
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
  sunFlareEffect?.destroy()
})
</script>

<template>
  <main class="aurora-home" :class="{ 'aurora-home--entering': isEntering }" aria-label="极光主页">
    <div class="aurora-shade" aria-hidden="true"></div>
    <button class="enter-galaxy" type="button" aria-label="进入星空" title="进入星空" :disabled="isEntering"
      @click="enterGalaxy" @animationend="finishSunFlight">
      <canvas ref="particleCanvas" class="sun-flare-effect" aria-hidden="true"></canvas>
    </button>
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
  background-color: #061326;
  background-image: url('/aurora.jpg');
  background-repeat: no-repeat;
  background-position: center 42%;
  background-size: cover;
}

.aurora-home::after {
  position: absolute;
  z-index: 1;
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
  z-index: -1;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(4, 10, 25, 0.12) 0%, transparent 42%, rgba(2, 8, 18, 0.44) 72%, #020813 100%),
    radial-gradient(ellipse at 50% 46%, transparent 28%, rgba(3, 11, 26, 0.2) 100%);
}

.enter-galaxy {
  --fireball-bottom: clamp(112px, 13vh, 168px);
  position: absolute;
  z-index: 2;
  left: 50%;
  bottom: var(--fireball-bottom);
  display: block;
  width: 132px;
  height: 132px;
  padding: 0;
  transform: translateX(-50%);
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #fff9dc;
  filter: drop-shadow(0 0 15px rgba(255, 207, 31, 0.7));
  cursor: pointer;
  transition: filter 180ms ease;
}

.enter-galaxy:hover {
  filter: drop-shadow(0 0 23px rgba(255, 226, 69, 0.95));
}

.enter-galaxy:focus-visible {
  outline: 2px solid #d9ffff;
  outline-offset: 5px;
}

.sun-flare-effect {
  position: absolute;
  left: 50%;
  top: 50%;
  display: block;
  transform: translate(-50%, -50%);
}

.sun-flare-effect {
  z-index: 3;
  width: 184px;
  height: 184px;
  pointer-events: none;
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
  .enter-galaxy {
    transition: none;
  }

  .aurora-home::after {
    transition: none;
  }
}
</style>
