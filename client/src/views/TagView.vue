<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { post } from '@/scripts/request'
import TagActivationView from './TagActivationView.vue'

const route = useRoute()

const loading = ref(true)
const exists = ref(false)
const active = ref(false)
const tag = route.params.tag as string

onMounted(() => {
  post('/wpi/user/tag', loading, { tag })
    .then((packet) => {
      exists.value = true
      active.value = (packet.data as { isActive?: boolean } | undefined)?.isActive === true
    })
})
</script>
<template>
  <TagActivationView v-if="!loading && exists && !active" :tag="tag" />
  <div v-else-if="!loading" class="empty-page" aria-hidden="true"></div>
</template>

<style scoped>
.empty-page {
  min-height: 100vh;
}
</style>
