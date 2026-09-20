<script setup lang="ts">
import { useAuthStore } from '../stores/auth'
import SplashCursor from '../components/SplashCursor.vue'

const auth = useAuthStore()
</script>

<template>
  <main v-if="auth.isLoggedIn">
    <SplashCursor />
  </main>
  <main v-else class="empty-page" aria-hidden="true"></main>
</template>

<style scoped>
.empty-page {
  min-height: 100vh;
}
</style>
