<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QRCode from 'qrcode'
import { post } from '@/scripts/request'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const exists = ref(false)
const qrcodeCanvas = ref(null)
const tag = route.params.tag as string
const { t } = useI18n()

onMounted(() => {
  post('/wpi/user/get', loading, { tag })
    .then(user => {
      exists.value = true
      setTimeout(() => {
        router.push('/main')
      }, 1000)
    })
    .catch(() => {
      const mobileUrl = `${window.location.origin}/user/info?tag=${tag}`
      QRCode.toCanvas(qrcodeCanvas.value, mobileUrl, { width: 300 }, (error) => {
        if (error) console.error(error)
      })
    })
})
</script>
<template>
  <div class="container">
    <div v-if="!loading">
      <h2>NFC TAG: {{ tag }}</h2>
      <p>{{ t('tag.notFound') }}</p>
      <canvas ref="qrcodeCanvas"></canvas>
      <p class="tip">{{ t('tag.tip') }}</p>
    </div>
  </div>
</template>

<style scoped>
.container {
  text-align: center;
  margin-top: 50px;
}

.tip {
  color: #888;
  margin-top: 10px;
}
</style>
