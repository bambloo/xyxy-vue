<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { GalaxyScene } from '../scripts/core/galaxy/GalaxyScene'

const canvasHost = ref<HTMLElement | null>(null)
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
  if (canvasHost.value) galaxyScene = new GalaxyScene(canvasHost.value)
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
    <button class="galaxy-control" type="button" aria-label="重置星空视角" @click="resetGalaxy">
      <span></span>
      <span></span>
      <span></span>
    </button>
  </main>
</template>

<style scoped>
.galaxy-demo {
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
  position: absolute;
  right: 28px;
  bottom: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 42px;
  height: 42px;
  padding: 0;
  border: 1px solid rgba(255, 220, 165, 0.9);
  border-radius: 50%;
  background: #e99545;
  box-shadow: 0 0 0 6px rgba(233, 149, 69, 0.12), 0 0 26px rgba(255, 159, 66, 0.5);
  cursor: pointer;
  z-index: 2;
}

.galaxy-control span {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #fff5e8;
}

.galaxy-control:hover {
  background: #f4aa5b;
}

.galaxy-demo :deep(canvas) {
  position: absolute;
  inset: 0;
  display: block;
  max-width: none;
  width: 100%;
  height: 100%;
}
</style>
