<template>
  <div class="schedule-page">
    <div class="page-heading">
      <div>
        <h1>我的课表</h1>
      </div>
      <div class="heading-right">
        <AppIcon name="clock" />
        {{ formatDate(teaching.serverDate) }} · {{ dayName(teaching.serverDate) }}
      </div>
    </div>
    <div class="schedule-overview">
      <div
        class="tabbar"
        role="tablist"
        aria-label="课表内容"
      >
        <button
          class="tab"
          :class="{ active: state.tab === 'arrange' }"
          role="tab"
          :aria-selected="state.tab === 'arrange'"
          data-tab="arrange"
          @click="switchTab('arrange')"
          @keydown.right.prevent="focusTab('records')"
          @keydown.left.prevent="focusTab('records')"
          :tabindex="state.tab === 'arrange' ? 0 : -1"
        >
          <AppIcon name="calendar" />
          教学安排
        </button>
        <button
          class="tab"
          :class="{ active: state.tab === 'records' }"
          role="tab"
          :aria-selected="state.tab === 'records'"
          data-tab="records"
          @click="switchTab('records')"
          @keydown.right.prevent="focusTab('arrange')"
          @keydown.left.prevent="focusTab('arrange')"
          :tabindex="state.tab === 'records' ? 0 : -1"
        >
          <AppIcon name="history" />
          上课记录
          <span
            v-if="recordCount !== null"
            class="count"
          >
            {{ recordCount }}
          </span>
        </button>
      </div>
      <WeekStats
        v-if="state.tab === 'arrange'"
        :date="state.date"
        compact
      />
    </div>
    <p
      v-if="teaching.initialized && incompleteLessonCount && state.tab === 'arrange'"
      class="schedule-data-note"
    >
      有 {{ incompleteLessonCount }} 节课程计划时间不完整，无法绘制到时间轴。
      <button
        class="today-btn"
        @click="state.view = 'list'"
      >
        查看课程列表
      </button>
    </p>
    <div class="schedule-layout">
      <section
        class="panel schedule-panel"
        aria-label="课表与课程列表"
      >
        <div class="schedule-controls">
          <div
            v-if="state.tab === 'arrange'"
            class="calendar-toolbar"
          >
            <div class="date-controls">
              <button
                class="icon-button"
                :aria-label="state.view === 'day' ? '上一天' : '上一周'"
                @click="shift(-1)"
              >
                <AppIcon name="chevronLeft" />
              </button>
              <span class="date-label">{{ dateLabel }}</span>
              <button
                class="icon-button"
                :aria-label="state.view === 'day' ? '下一天' : '下一周'"
                @click="shift(1)"
              >
                <AppIcon name="chevronRight" />
              </button>
              <button
                class="today-btn"
                @click="goToday"
              >
                今天
              </button>
              <input
                class="jump-date"
                type="date"
                aria-label="跳转课表日期"
                title="选择日期，快速查看课表"
                :value="state.date"
                @change="jumpDate"
              />
            </div>
            <div
              class="segmented"
              aria-label="课表视图"
            >
              <button
                v-for="view in SCHEDULE_VIEWS"
                :key="view.id"
                :class="{ active: state.view === view.id }"
                :aria-pressed="state.view === view.id"
                :data-view="view.id"
                @click="state.view = view.id"
              >
                {{ view.label }}
              </button>
            </div>
          </div>
          <div class="filterbar">
            <div
              v-if="state.tab === 'records'"
              class="date-filter"
            >
              <span>日期</span>
              <input
                id="fromDate"
                type="date"
                aria-label="记录开始日期"
                :value="state.from"
                @change="updateRange($event, 'from')"
              />
              <span>至</span>
              <input
                id="toDate"
                type="date"
                aria-label="记录结束日期"
                :value="state.to"
                @change="updateRange($event, 'to')"
              />
            </div>
            <div class="input-wrap">
              <AppIcon name="search" />
              <input
                id="search"
                v-model="search"
                aria-label="搜索学生或课程"
                placeholder="搜索学生、课程"
              />
              <button
                v-if="search"
                class="clear-search"
                aria-label="清除搜索"
                @click="search = ''"
              >
                <AppIcon name="close" />
              </button>
            </div>
            <select
              id="statusFilter"
              v-model="status"
              aria-label="课程状态"
            >
              <option value="all">全部状态</option>
              <option
                v-for="option in statusOptions"
                :key="option"
                :value="option"
              >
                {{ STATUS_LABELS[option] }}
              </option>
            </select>
            <button
              v-if="search || status !== 'all'"
              class="today-btn"
              @click="resetFilters"
            >
              重置筛选
            </button>
            <button
              class="today-btn"
              :disabled="teaching.loading"
              @click="refresh()"
            >
              {{ teaching.loading ? '刷新中…' : '刷新' }}
            </button>
          </div>
        </div>
        <div
          v-if="teaching.loading"
          class="empty"
          role="status"
        >
          <strong>正在加载课表…</strong>
        </div>
        <div
          v-else-if="teaching.errorMessage"
          class="empty"
          role="alert"
        >
          <strong>课表加载失败</strong>
          <p>{{ teaching.errorMessage }}</p>
          <button
            class="secondary"
            @click="refresh()"
          >
            重新加载
          </button>
        </div>
        <template v-else-if="state.tab === 'records'">
          <div class="record-banner">
            已完成
            <strong>{{ completedCount }}</strong>
            节 · 实际累计
            <strong>{{ totalMinutes }}</strong>
            分钟 / 当前筛选结果
            <p>记录按排课最终状态展示；实际授课时间尚未提供。</p>
          </div>
          <LessonTable
            :lessons="visibleLessons"
            :selected-id="state.selectedId"
            history
            @select="openLesson"
            @enter="enter"
            @reset="resetFilters"
          />
        </template>
        <LessonTable
          v-else-if="state.view === 'list'"
          :lessons="visibleLessons"
          :selected-id="state.selectedId"
          @select="openLesson"
          @enter="enter"
          @reset="resetFilters"
        />
        <div
          v-else-if="(search || status !== 'all') && !visibleLessons.length"
          class="empty"
          role="status"
        >
          <AppIcon name="search" />
          <strong>没有符合条件的课程</strong>
          <p>试试其他学生姓名、课程名称，或清除筛选条件。</p>
          <button
            class="secondary"
            @click="resetFilters"
          >
            重置筛选
          </button>
        </div>
        <template v-else>
          <div
            ref="calendarScroll"
            class="calendar-scroll"
          >
            <div
              class="calendar"
              :class="state.view === 'week' ? 'week' : 'day-calendar'"
              :style="{
                '--calendar-height': calendarHeight,
                '--calendar-hour-height': `${CALENDAR_HOUR_HEIGHT}px`,
              }"
            >
              <template v-if="state.view === 'week'">
                <div class="day-header" />
                <button
                  v-for="date in dates"
                  :key="date"
                  class="day-header"
                  :class="{ today: date === teaching.serverDate, selected: date === state.date }"
                  :aria-label="`${formatDate(date)} ${dayName(date)}`"
                  :aria-pressed="date === state.date"
                  @click="state.date = date"
                >
                  <div>
                    {{ dayName(date) }}
                    <i
                      v-if="teaching.lessons.some((lesson) => lesson.date === date)"
                      class="date-dot"
                    />
                  </div>
                  <strong>{{ dateObject(date).getDate() }}</strong>
                </button>
              </template>
              <div
                v-else
                class="day-banner"
              >
                {{ formatDate(state.date) }} {{ dayName(state.date) }} ·
                {{ visibleLessons.length }} 节课
              </div>
              <div
                :class="{ 'day-body': state.view === 'day', 'week-body': state.view === 'week' }"
              >
                <div class="time-column">
                  <div
                    v-for="hour in calendarHours"
                    :key="hour"
                    class="time-label"
                    :style="{ top: `${(hour - calendarStart) * CALENDAR_HOUR_HEIGHT}px` }"
                  >
                    {{ hour }}:00
                  </div>
                </div>
                <div
                  v-for="column in calendarColumns"
                  :key="column.date"
                  class="day-column"
                  :class="{ today: column.date === teaching.serverDate }"
                >
                  <button
                    v-for="event in column.events"
                    :key="event.key"
                    class="event"
                    :class="[
                      event.lesson?.status || `slot-${event.slot?.status}`,
                      {
                        selected: event.lesson?.id === state.selectedId,
                        'event-short': event.end - event.start < 40,
                        'event-narrow': event.lanes > 1,
                      },
                    ]"
                    :style="eventStyle(event)"
                    :title="
                      event.lesson
                        ? `${courseName(event.lesson)} · ${event.lesson.student} · ${event.lesson.startTime} — ${event.lesson.endTime} · ${STATUS_LABELS[event.lesson.status]}`
                        : `${slotStatus(event.slot!)} · ${event.slot?.startTime} — ${event.slot?.endTime}`
                    "
                    @click="openEvent(event)"
                  >
                    <strong>
                      {{ event.lesson ? event.lesson.student : slotStatus(event.slot!) }}
                    </strong>
                    <span
                      v-if="event.lesson"
                      class="event-course"
                    >
                      {{ event.lesson.subject || '课程' }} · {{ event.lesson.grade }}
                    </span>
                    <div class="event-meta">
                      <small>{{ minutesToTime(event.start) }}–{{ minutesToTime(event.end) }}</small>
                      <span
                        v-if="event.lesson"
                        class="event-status"
                      >
                        {{ STATUS_LABELS[event.lesson.status] }}
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div class="calendar-foot">
            <div class="status-legend">
              <span>
                <i />
                待建课 / 已建课
              </span>
              <span>
                <i class="green" />
                空闲时段
              </span>
              <span>
                <i class="gray" />
                已完成
              </span>
              <span>
                <i class="orange" />
                占用 / 关闭
              </span>
            </div>
            <span>点击课程查看详情</span>
          </div>
        </template>
      </section>
    </div>
    <dialog
      ref="detailDialog"
      class="lesson-drawer"
      aria-label="课程详情"
      @click="closeDrawerOnBackdrop"
    >
      <div class="drawer-title">
        <span>课程信息</span>
        <button
          class="icon-button"
          aria-label="关闭课程详情"
          @click="detailDialog?.close()"
        >
          <AppIcon name="close" />
        </button>
      </div>
      <LessonDetail
        :lesson="selected"
        @enter="enterFromDrawer"
        @records="showRecords"
      />
      <div
        v-if="state.tab === 'arrange'"
        class="panel daily-mini"
      >
        <h3>{{ formatDate(state.date) }} · {{ dailyLessons.length }} 节课</h3>
        <button
          v-for="lesson in dailyLessons"
          :key="lesson.id"
          class="daily-item"
          @click="selectDailyLesson(lesson)"
        >
          <span class="time">{{ lesson.start }}</span>
          <div>
            <strong>{{ lesson.student }}</strong>
            <p>{{ courseName(lesson) }}</p>
          </div>
          <LessonBadge :status="lesson.status" />
        </button>
        <p
          v-if="!dailyLessons.length"
          class="course-sub"
        >
          当天没有安排课程
        </p>
      </div>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import LessonBadge from '@/components/LessonBadge.vue'
import LessonDetail from '@/components/LessonDetail.vue'
import LessonTable from '@/components/LessonTable.vue'
import WeekStats from '@/components/WeekStats.vue'
import { useSchedule } from '@/composables/useSchedule'
import { CALENDAR_HOUR_HEIGHT, SCHEDULE_VIEWS, STATUS_LABELS } from '@/constants/teaching'
import { dateObject, dayName, formatDate, minutesToTime, timeToMinutes } from '@/utils/date'
import { courseName } from '@/utils/lesson'
import { slotStatus, validCalendarTime } from '@/utils/teacherSchedule'
import type { CalendarEvent } from '@/utils/teacherSchedule'
import type { Lesson } from '@/types/teaching'
import { shanghaiClock } from '@/utils/teacherHome'

// 页面只负责 DOM 和事件绑定，筛选与路由定位规则集中在 useSchedule。
const route = useRoute()
const {
  state,
  teaching,
  dates,
  search,
  status,
  statusOptions,
  visibleLessons,
  selected,
  dailyLessons,
  recordCount,
  completedCount,
  totalMinutes,
  dateLabel,
  calendarColumns,
  calendarHours,
  calendarStart,
  calendarHeight,
  refresh,
  selectEvent,
  switchTab,
  shift,
  resetFilters,
  updateRange,
  enter,
  selectDailyLesson,
  eventStyle,
} = useSchedule()
const detailDialog = ref<HTMLDialogElement>()
const calendarScroll = ref<HTMLElement>()
watch(
  [() => route.query.lesson, () => teaching.initialized],
  async ([id, ready]) => {
    if (!id || !ready) return
    await nextTick()
    if (selected.value && String(selected.value.id) === String(id) && !detailDialog.value?.open)
      detailDialog.value?.showModal()
  },
  { immediate: true },
)
async function focusTab(tab: 'arrange' | 'records'): Promise<void> {
  switchTab(tab)
  await nextTick()
  document.querySelector<HTMLButtonElement>(`[data-tab="${tab}"]`)?.focus()
}
function jumpDate(event: Event): void {
  const input = event.target as HTMLInputElement
  if (/^\d{4}-\d{2}-\d{2}$/.test(input.value) && !Number.isNaN(dateObject(input.value).getTime()))
    state.date = input.value
  else input.value = state.date
}
function openEvent(event: CalendarEvent) {
  selectEvent(event)
  if (event.lesson) detailDialog.value?.showModal()
}
function openLesson(lesson: Lesson) {
  state.selectedId = lesson.id
  detailDialog.value?.showModal()
}
function enterFromDrawer(lesson: Lesson) {
  detailDialog.value?.close()
  enter(lesson)
}
function showRecords() {
  detailDialog.value?.close()
  switchTab('records')
}
function closeDrawerOnBackdrop(event: MouseEvent) {
  if (event.target !== detailDialog.value) return
  const bounds = detailDialog.value!.getBoundingClientRect()
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
    detailDialog.value?.close()
}
watch(
  [() => teaching.loading, () => state.date, () => state.view, () => state.tab],
  scrollCalendar,
  { immediate: true },
)
async function scrollCalendar() {
  await nextTick()
  if (teaching.loading || !calendarScroll.value) return
  const events = calendarColumns.value.find((column) => column.date === state.date)?.events || []
  const clock = shanghaiClock()
  const focus =
    state.date === clock.date ? timeToMinutes(clock.time.slice(0, 5)) : (events[0]?.start ?? 8 * 60)
  calendarScroll.value.scrollTop = Math.max(
    0,
    (focus / 60 - calendarStart.value - 1) * CALENDAR_HOUR_HEIGHT,
  )
}
function goToday() {
  state.date = teaching.serverDate
  void scrollCalendar()
}
const incompleteLessonCount = computed(
  () =>
    teaching.lessons.filter((lesson) => !validCalendarTime(lesson.startTime, lesson.endTime))
      .length,
)
</script>

<style lang="less" scoped>
@import '@/styles/components/schedule.less';
</style>
