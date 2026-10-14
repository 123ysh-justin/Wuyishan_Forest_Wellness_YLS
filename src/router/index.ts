import { createRouter, createWebHashHistory } from 'vue-router'

const Home = () => import('../views/Home.vue')
const BaseDetail = () => import('../views/BaseDetail.vue')
const SandboxReal = () => import('../views/SandboxReal.vue')
const CourseDetail = () => import('../views/CourseDetail.vue')
const Courses = () => import('../views/Courses.vue')
const MapTest = () => import('../views/MapTest.vue')

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/courses', component: Courses },
    { path: '/course/:id', component: CourseDetail },
    { path: '/base/:id', component: BaseDetail },
    { path: '/base/:id/sandbox', component: SandboxReal },
    { path: '/map-test', component: MapTest }
  ],
  scrollBehavior: () => ({ top: 0 })
})
