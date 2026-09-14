import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import TagView from '@/views/TagView.vue'
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/*',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/:tag',
      name: 'tag',
      component: TagView,
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
  ],
})

export default router
