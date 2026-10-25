<script setup lang="ts">
import { useRouter } from 'vue-router'
import UserProfileEditDialog from '@/components/dialogs/UserProfileEditDialog.vue'

const router = useRouter()

function closeProfileDialog() {
  void router.replace({ name: 'galaxy' })
}
</script>

<template>
  <UserProfileEditDialog :open="true" @close="closeProfileDialog" />
</template>
