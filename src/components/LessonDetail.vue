<template>
  <aside
    class="panel side-panel"
    data-testid="lesson-detail"
  >
    <template v-if="lesson">
      <div class="side-heading">
        <strong>{{ isFinal(lesson) ? '上课记录' : '课程详情' }}</strong>
        <span class="caption">排课 #{{ lesson.bookingId }}</span>
      </div>
      <div class="person">
        <div
          class="avatar"
          :class="avatarClass(lesson.student)"
        >
          {{ lesson.student.slice(0, 1) }}
        </div>
        <div>
          <strong>{{ lesson.student }}</strong>
          <p>授课学生</p>
        </div>
        <LessonBadge :status="lesson.status" />
      </div>
      <div class="course-title">{{ courseName(lesson) }}</div>
      <div class="course-sub">1 对 1 在线授课 · 计划 {{ plannedMinutes ?? '—' }} 分钟</div>
      <div class="detail-lines">
        <div class="detail-line">
          <AppIcon name="calendar" />
          <div>
            <span class="detail-label">计划上课时间</span>
            <strong>
              {{ lesson.startTime?.slice(0, 16) || '时间待补充' }}
              <br />
              至 {{ lesson.endTime?.slice(0, 16) || '时间待补充' }}
            </strong>
          </div>
        </div>
        <div class="detail-line">
          <AppIcon name="user" />
          <div>
            <span class="detail-label">授课教师</span>
            <strong>{{ teaching.teacher.name }}</strong>
          </div>
        </div>
        <div class="detail-line">
          <AppIcon name="video" />
          <div>
            <span class="detail-label">上课方式</span>
            <strong>在线音视频课堂</strong>
          </div>
        </div>
      </div>
      <div class="record-lines">
        <div class="record-line">
          <span>学管师</span>
          <strong>{{ lesson.studyManagerName || '—' }}</strong>
        </div>
        <div class="record-line">
          <span>排课操作人</span>
          <strong>{{ lesson.bookingOperatorName || '—' }}</strong>
        </div>
        <div
          v-if="lesson.bookVersion"
          class="record-line"
        >
          <span>教材版本</span>
          <strong>{{ lesson.bookVersion }}</strong>
        </div>
        <div class="record-line">
          <span>课程报告</span>
          <strong>{{ flagLabel(lesson.hasCourseReport) }}</strong>
        </div>
        <div class="record-line">
          <span>课堂反馈</span>
          <strong>{{ flagLabel(lesson.hasClassFeedback) }}</strong>
        </div>
      </div>
      <template v-if="isFinal(lesson)">
        <div class="record-total">
          <span>实际授课时长</span>
          <div>
            <strong>{{ lesson.duration ?? '—' }}</strong>
            <small v-if="lesson.duration !== undefined">分钟</small>
          </div>
        </div>
        <div class="record-lines">
          <div class="record-line">
            <span>实际开始</span>
            <strong>{{ lesson.actualStart ?? '—' }}</strong>
          </div>
          <div class="record-line">
            <span>实际结束</span>
            <strong>{{ lesson.actualEnd ?? '—' }}</strong>
          </div>
        </div>
        <div class="callout">状态来自排课记录，实际授课时间尚未提供。</div>
        <div class="detail-actions">
          <button
            class="secondary side-action"
            @click="$emit('records')"
          >
            查看上课记录
            <AppIcon name="chevronRight" />
          </button>
        </div>
      </template>
      <template v-else>
        <div class="callout">
          {{
            lesson.roomClosed
              ? '本次会话中已关闭视频课堂。'
              : canEnter(lesson)
                ? '进入教室后，可开启音视频并准备白板与课件。'
                : '课程状态或上课时间不完整，暂无法准备上课。'
          }}
        </div>
        <div class="detail-actions">
          <button
            class="primary full"
            :disabled="!canEnter(lesson)"
            @click="$emit('enter', lesson)"
          >
            <AppIcon
              v-if="canEnter(lesson)"
              name="play"
            />
            {{ canEnter(lesson) ? '准备上课' : '暂不可上课' }}
          </button>
          <p class="side-note">请检查摄像头与麦克风，教室按排课时间开放。</p>
        </div>
      </template>
    </template>
    <div
      v-else
      class="empty"
    >
      <AppIcon name="calendar" />
      <strong>请选择一节课程</strong>
      <p>点击课表中的课程，即可查看完整信息。</p>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import LessonBadge from '@/components/LessonBadge.vue'
import { useTeachingStore } from '@/stores/teaching'
import type { Lesson } from '@/types/teaching'
import { avatarClass, canEnter, courseName, isFinal } from '@/utils/lesson'
import { validCalendarTime } from '@/utils/teacherSchedule'
const props = defineProps<{ lesson?: Lesson }>()
defineEmits<{ enter: [lesson: Lesson]; records: [] }>()
const teaching = useTeachingStore()
const plannedMinutes = computed(() => {
  const lesson = props.lesson
  if (!lesson || !validCalendarTime(lesson.startTime, lesson.endTime)) return null
  return (
    (Date.parse(`${lesson.endTime!.replace(' ', 'T')}+08:00`) -
      Date.parse(`${lesson.startTime!.replace(' ', 'T')}+08:00`)) /
    60000
  )
})
function flagLabel(value?: boolean | null): string {
  return value === true ? '已填写' : value === false ? '未填写' : '—'
}
</script>

<style lang="less" scoped>
@import '@/styles/components/detail.less';
</style>
