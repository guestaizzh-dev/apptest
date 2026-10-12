<template>
  <!-- 独立课堂由路由元信息控制，未来动态路由无需在此枚举页面名称。 -->
  <RouterView v-if="route.meta.public || fullscreen" />
  <template v-else>
    <aside class="sidebar">
      <RouterLink
        class="brand"
        to="/"
      >
        <span class="brand-icon">
          <img
            src="/brand-logo.png"
            alt=""
          />
        </span>
        <span>
          归途智学
          <small>1 对 1 教学工作台</small>
        </span>
      </RouterLink>
      <div class="nav-label">工作空间</div>
      <nav aria-label="主导航">
        <RouterLink
          v-for="item in navigationItems"
          :key="item.name"
          :to="{ name: item.name }"
          :class="{ active: route.name === item.name }"
          :title="item.title"
        >
          <AppIcon :name="item.icon" />
          <span class="nav-title">{{ item.title }}</span>
          <span
            v-if="route.name === item.name"
            class="nav-dot"
          />
        </RouterLink>
      </nav>
      <div class="sidebar-bottom">
        <div class="mini-logo">1:1</div>
        <strong>专注每一节好课</strong>
        <p>安排、上课、记录，一处完成。</p>
        <span class="version">PC 教师端 · V2.1</span>
      </div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <div class="workspace-name">
          <span>教师工作台</span>
          <span class="workspace-divider" />
          <span class="breadcrumb">{{ route.meta.title }}</span>
        </div>
        <div class="account">
          <button
            class="icon-button notification"
            aria-label="课程提醒"
            @click="showReminder"
          >
            <AppIcon name="bell" />
          </button>
          <div class="avatar small">{{ accountName.slice(0, 1) }}</div>
          <span>{{ accountName }}</span>
          <button
            class="logout-button"
            :disabled="auth.loggingOut"
            @click="logout"
          >
            {{ auth.loggingOut ? '正在退出…' : '退出登录' }}
          </button>
        </div>
      </header>
      <main>
        <RouterView />
      </main>
    </div>
  </template>
  <div
    v-if="ui.toast"
    class="toast show"
    :class="{ 'toast-top': ui.toastPosition === 'top' }"
    :role="ui.toastPosition === 'top' ? 'alert' : 'status'"
  >
    <AppIcon
      v-if="ui.toastPosition === 'top'"
      name="info"
    />
    <span>{{ ui.toast }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import { STATUS_LABELS } from '@/constants/teaching'
import { routeRegistry } from '@/router'
import { getNavigationItems } from '@/router/registry'
import { useScheduleStore } from '@/stores/schedule'
import { useTeachingStore } from '@/stores/teaching'
import { useUiStore } from '@/stores/ui'
import { formatDate } from '@/utils/date'
import { courseName } from '@/utils/lesson'
import { useAuthStore } from '@/stores/auth'
import { sessionToken } from '@/services/session'
import { useTeacherHomeStore } from '@/stores/teacherHome'
import { teacherCourseName } from '@/utils/teacherHome'

const route = useRoute()
const router = useRouter()
const teaching = useTeachingStore()
const schedule = useScheduleStore()
const ui = useUiStore()
const auth = useAuthStore()
const home = useTeacherHomeStore()

const accountName = computed(() => auth.user?.userName || teaching.teacher.name)
const fullscreen = computed(() => route.meta.fullscreen === true)
const navigationItems = computed(() => {
  // getRoutes() 本身不响应式；注册器版本变化时重新生成菜单。
  void routeRegistry.revision.value
  return getNavigationItems(router)
})

watch(sessionToken, (token, previousToken) => {
  if (previousToken && token !== previousToken) {
    teaching.reset()
    schedule.$reset()
  }
  if (!token && previousToken && route.name !== 'login') {
    void router.replace({
      name: 'login',
      query: { redirect: route.fullPath },
    })
  }
})

async function logout(): Promise<void> {
  try {
    await auth.logout()
    await router.replace({ name: 'login' })
  } catch (error) {
    ui.notify(error instanceof Error ? error.message : '退出失败，请稍后重试。')
  }
}

function showReminder(): void {
  if (route.name !== 'schedule') {
    const course = home.nextCourse
    ui.notify(
      home.errorMessage
        ? '课程数据加载失败，请先刷新首页。'
        : !home.initialized
          ? '首页课程尚未加载完成。'
          : course
            ? `${course.startTime?.slice(0, 16)} ${teacherCourseName(course)} · ${course.studentName}`
            : '当前查询范围内没有待授课程',
    )
    return
  }
  if (teaching.loading || teaching.errorMessage) {
    ui.notify(teaching.loading ? '课表正在加载，请稍后查看。' : '课表加载失败，请刷新后查看。')
    return
  }
  const lesson = teaching.nextLesson
  const message = lesson
    ? `所选范围内待授课程：${formatDate(lesson.date)} ${lesson.start} ${courseName(lesson)} · ${STATUS_LABELS[lesson.status]}`
    : '所选范围内没有待授课程'
  ui.notify(message)
}
</script>

<style lang="less" scoped>
@import '@/styles/components/layout.less';
</style>
