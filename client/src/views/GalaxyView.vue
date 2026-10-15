<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { TIME_FORTUNE_OPEN_EVENT } from '@/events/time-fortune'
import { GalaxyScene } from '../scripts/core/galaxy/GalaxyScene.ts'

const canvasHost = ref<HTMLElement | null>(null)
let galaxyScene: GalaxyScene | undefined

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
      window.dispatchEvent(new Event(TIME_FORTUNE_OPEN_EVENT))
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

.galaxy-canvas :deep(canvas) {
  position: absolute;
  inset: 0;
  display: block;
  max-width: none;
  width: 100%;
  height: 100%;
}
</style>
