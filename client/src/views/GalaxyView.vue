<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { GalaxyScene } from '../scripts/core/galaxy/GalaxyScene.ts'
import SunPortalButton from '../components/SunPortalButton.vue'

const canvasHost = ref<HTMLElement | null>(null)
const isSunPortalVisible = ref(false)
let galaxyScene: GalaxyScene | undefined

function resetGalaxy() {
  galaxyScene?.resetView()
}

function handlePointerDown(event: PointerEvent) {
  galaxyScene?.pointerDown(event)
}

function handlePointerMove(event: PointerEvent) {
  galaxyScene?.pointerMove(event)
}

function handlePointerUp(event: PointerEvent) {
  galaxyScene?.pointerUp(event)
}

function handleWheel(event: WheelEvent) {
  galaxyScene?.wheel(event)
}

onMounted(() => {
  if (canvasHost.value) {
    galaxyScene = new GalaxyScene(canvasHost.value, () => {
      isSunPortalVisible.value = true
    })
  }
})

onBeforeUnmount(() => {
  galaxyScene?.destroy()
  galaxyScene = undefined
})
</script>

<template>
  <main class="galaxy-demo" aria-label="旋转星空 Demo">
    <section ref="canvasHost" class="galaxy-canvas" @pointerdown="handlePointerDown" @pointermove="handlePointerMove"
      @pointerup="handlePointerUp" @pointercancel="handlePointerUp" @wheel.prevent="handleWheel"></section>
    <Transition name="portal-arrive">
      <SunPortalButton v-if="isSunPortalVisible" class="galaxy-control" label="上划重置星空视角" title="上划重置星空视角"
        @swipe-up="resetGalaxy" />
    </Transition>
  </main>
</template>

<style scoped>
.galaxy-demo {
  position: relative;
  isolation: isolate;
  width: 100vw;
  height: 100dvh;
  min-height: 100vh;
  overflow: hidden;
  background: radial-gradient(circle at 50% 52%, #152441 0, #090e1d 33%, #02040b 72%);
  color: #eef4ff;
}

.galaxy-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.galaxy-canvas:active {
  cursor: grabbing;
}

.galaxy-control {
  --fireball-bottom: clamp(112px, 13vh, 168px);
  position: absolute;
  left: 50%;
  bottom: var(--fireball-bottom);
  width: 132px;
  height: 132px;
  z-index: 2;
  transform: translateX(-50%) scale(1);
}

.portal-arrive-enter-active {
  transition: opacity 900ms ease-out, transform 900ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.portal-arrive-enter-from {
  opacity: 0;
  transform: translateX(-50%) scale(0.12);
}

.galaxy-canvas :deep(canvas) {
  position: absolute;
  inset: 0;
  display: block;
  max-width: none;
  width: 100%;
  height: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .portal-arrive-enter-active {
    transition: none;
  }
}
</style>
