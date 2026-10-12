<template>
  <div
    v-if="lesson"
    class="classroom-page"
  >
    <RealtimeClassroom
      ref="classroom"
      :booking-id="bookingId"
      :course-title="`${lesson.student}-${courseName(lesson)}${lesson.bookVersion ? '-' + lesson.bookVersion : ''}`"
      :student-name="lesson.student"
      :teacher-name="auth.user?.userName || teaching.teacher.name"
      :ending="processing"
      :closed="closed"
      @request-close="finishDialog?.showModal()"
      @request-leave="leave"
    >
      <template #information>
        <template v-if="lesson.bookingId">
          <div class="classroom-person">
            <span>{{ lesson.student.slice(0, 1) }}</span>
            <strong>{{ lesson.student }}</strong>
          </div>
          <div class="classroom-detail">
            {{ courseName(lesson) }}
            <br />
            {{ formatDate(lesson.date) }}
            <br />
            {{ lesson.start }} — {{ lesson.end }}
          </div>
        </template>
        <div
          v-else
          class="classroom-detail"
        >
          {{ bookingId ? `已指定真实排课 #${bookingId}` : '等待选择真实排课' }}
          <p>教师身份与可上课时间由服务器校验。</p>
        </div>
      </template>
    </RealtimeClassroom>
    <dialog
      ref="finishDialog"
      class="classroom-dialog"
      aria-label="结束本节课堂"
      @cancel="cancelDialog"
    >
      <div class="dialog-header">
        <h2>结束本节课堂？</h2>
        <button
          class="icon-button"
          aria-label="关闭结束提示"
          :disabled="processing"
          @click="finishDialog?.close()"
        >
          <AppIcon name="close" />
        </button>
      </div>
      <div class="dialog-body">
        <p class="finish-copy">
          结束后将禁止再次进入本节课堂，并关闭你的音视频。学生端检测到课堂结束后会自动退出。此操作不扣除课时。
        </p>
        <div class="dialog-actions">
          <button
            class="secondary"
            :disabled="processing"
            @click="finishDialog?.close()"
          >
            继续授课
          </button>
          <button
            class="primary"
            :disabled="processing"
            @click="finish"
          >
            {{ processing ? '正在关闭…' : '确认结束课堂' }}
          </button>
        </div>
      </div>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import RealtimeClassroom from '@/components/RealtimeClassroom.vue'
import { closeVideoClassroom } from '@/api/rtc'
import { useAuthStore } from '@/stores/auth'
import { useTeachingStore } from '@/stores/teaching'
import { useUiStore } from '@/stores/ui'

import { formatDate } from '@/utils/date'
import { courseName } from '@/utils/lesson'

const route = useRoute()
const router = useRouter()
const teaching = useTeachingStore()
const auth = useAuthStore()
const ui = useUiStore()
const lesson = computed(() => teaching.getLesson(String(route.params.id)))
const bookingId = computed(() => lesson.value?.bookingId)
const closed = ref(false)
const processing = ref(false)
const classroom = ref<InstanceType<typeof RealtimeClassroom>>()
const finishDialog = ref<HTMLDialogElement>()

watch(
  () => route.params.id,
  () => {
    closed.value = false
    finishDialog.value?.close()
  },
)
// 路由返回/切换也提交 leave；失败时留下重试入口，不让迟到请求闭合下一次入房。
onBeforeRouteLeave(exitBeforeNavigation)
onBeforeRouteUpdate(exitBeforeNavigation)

async function exitBeforeNavigation(): Promise<boolean> {
  if (processing.value) return !auth.authenticated
  processing.value = true
  try {
    await classroom.value?.disconnect()
    return true
  } catch (error) {
    ui.notify(error instanceof Error ? error.message : '离课记录提交失败，请重试。')
    return !auth.authenticated
  } finally {
    processing.value = false
  }
}

function cancelDialog(event: Event): void {
  if (processing.value) event.preventDefault()
}
async function leave(): Promise<void> {
  if (processing.value) return
  await router.push({
    name: 'schedule',
    query: { tab: 'arrange', lesson: lesson.value?.id, date: lesson.value?.date },
  })
}
async function finish(): Promise<void> {
  const id = bookingId.value
  if (!id || processing.value) return
  processing.value = true
  try {
    await closeVideoClassroom(id)
    teaching.markRoomClosed(id)
    closed.value = true
    finishDialog.value?.close()
    try {
      await classroom.value?.disconnect()
    } catch (error) {
      ui.notify(
        `视频课堂已关闭，离课记录提交失败，请重试：${error instanceof Error ? error.message : '网络异常'}`,
      )
      return
    }
    finishDialog.value?.close()
    ui.notify('视频课堂已关闭。')
  } catch (error) {
    ui.notify(error instanceof Error ? error.message : '关闭课堂失败，请重试。')
  } finally {
    processing.value = false
  }
}
</script>

<style lang="less" scoped>
@import '@/styles/components/classroom.less';
</style>
