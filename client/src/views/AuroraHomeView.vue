<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { MilkyWayBackground } from '../scripts/core/galaxy/MilkyWayBackground'

const backgroundCanvas = ref<HTMLCanvasElement | null>(null)
let milkyWayBackground: MilkyWayBackground | undefined

onMounted(() => {
  if (backgroundCanvas.value) milkyWayBackground = new MilkyWayBackground(backgroundCanvas.value)
})

onBeforeUnmount(() => {
  milkyWayBackground?.destroy()
})
</script>

<template>
  <main class="aurora-home" aria-label="极光主页">
    <canvas ref="backgroundCanvas" class="milky-way-background" aria-hidden="true"></canvas>
    <div class="aurora-shade" aria-hidden="true"></div>
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

.aurora-shade {
  position: absolute;
  z-index: 1;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(4, 10, 25, 0.12) 0%, transparent 42%, rgba(2, 8, 18, 0.44) 72%, #020813 100%),
    radial-gradient(ellipse at 50% 46%, transparent 28%, rgba(3, 11, 26, 0.2) 100%);
}
</style>
