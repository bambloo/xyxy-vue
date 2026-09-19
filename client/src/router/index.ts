import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import TagView from '@/views/TagView.vue'
import UserManagementView from '@/views/user/UserManagementView.vue'
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/user',
      name: 'user',
      component: UserManagementView,
    },
    {
      path: '/:tag',
      name: 'tag',
      component: TagView,
    },
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/user',
    },
  ],
})

export default router
