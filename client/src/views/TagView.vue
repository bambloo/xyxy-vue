<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { post } from '@/scripts/request'

const route = useRoute()

const loading = ref(true)
const exists = ref(false)
const tag = route.params.tag as string

onMounted(() => {
  post('/wpi/user/tag', loading, { tag })
    .then(() => {
      exists.value = true
    })
})
</script>
<template>
  <div v-if="!loading && !exists" class="empty-page" aria-hidden="true"></div>
</template>

<style scoped>
.empty-page {
  min-height: 100vh;
}
</style>
