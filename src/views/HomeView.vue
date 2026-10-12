<template>
  <div
    class="home-dashboard"
    :aria-busy="home.loading"
  >
    <div class="dashboard-heading">
      <div>
        <h1>{{ greeting }}，{{ auth.user?.userName }}</h1>
        <p v-if="home.initialized && !home.errorMessage">
          今天安排
          <strong>{{ summary.today.length }}</strong>
          节课，其中
          <strong>{{ summary.todayPending }}</strong>
          节未完成。
        </p>
        <p v-else>查看今天的课程安排与本周教学进度。</p>
      </div>
      <div class="home-heading-actions">
        <span class="date-link">
          <AppIcon name="calendar" />
          {{ formatDate(home.date) }} · {{ dayName(home.date) }}
        </span>
        <button
          class="secondary home-refresh"
          :disabled="home.loading"
          @click="refresh"
        >
          {{ home.loading ? '正在更新…' : '刷新数据' }}
        </button>
      </div>
    </div>
    <section
      v-if="home.errorMessage"
      class="panel dashboard-empty"
      role="alert"
    >
      <AppIcon name="info" />
      <strong>首页数据加载失败</strong>
      <p>{{ home.errorMessage }}</p>
      <button
        class="secondary"
        :disabled="home.loading"
        @click="refresh"
      >
        重新加载
      </button>
    </section>
    <section
      v-else-if="!home.initialized"
      class="panel dashboard-empty"
      role="status"
    >
      <AppIcon name="calendar" />
      <strong>正在加载教师课程…</strong>
      <p>读取今日安排、本周进度和近期完成课程。</p>
    </section>
    <template v-else>
      <div class="dashboard-metrics">
        <div
          v-for="metric in metrics"
          :key="metric.label"
          class="dashboard-metric"
        >
          <div class="metric-heading">
            <span>{{ metric.label }}</span>
            <span
              class="metric-icon"
              :class="metric.tone"
            >
              <AppIcon :name="metric.icon" />
            </span>
          </div>
          <div class="metric-number">
            {{ metric.value }}
            <small>{{ metric.unit }}</small>
          </div>
          <p>{{ metric.note }}</p>
        </div>
      </div>
      <p
        v-if="home.incompleteCount"
        class="home-data-note"
        role="status"
      >
        有 {{ home.incompleteCount }} 节课程计划时间不完整，相关统计或最近课程推荐可能缺少这些课程。
      </p>
      <div class="dashboard-grid">
        <div class="dashboard-primary">
          <section
            class="panel today-panel"
            aria-labelledby="today-title"
          >
            <div class="dashboard-section-heading">
              <div>
                <h2 id="today-title">今日课程</h2>
                <span class="section-count">{{ summary.today.length }} 节</span>
              </div>
              <span>按计划时间排序</span>
            </div>
            <div
              v-if="summary.today.length"
              class="today-table-wrap"
            >
              <table class="today-table">
                <thead>
                  <tr>
                    <th>计划时间</th>
                    <th>学生 / 课程</th>
                    <th>约课状态</th>
                    <th class="action-column">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="course in summary.today"
                    :key="course.bookingId"
                  >
                    <td>
                      <strong class="lesson-start">{{ shortTime(course.startTime) }}</strong>
                      <small>{{ shortTime(course.endTime) }} 结束</small>
                    </td>
                    <td>
                      <button
                        class="lesson-person"
                        @click="select(course)"
                      >
                        <span
                          class="avatar small"
                          :class="avatarClass(course.studentName)"
                        >
                          {{ course.studentName.slice(0, 1) }}
                        </span>
                        <span>
                          <strong>{{ course.studentName }}</strong>
                          <small>{{ teacherCourseName(course) }}</small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <span
                        class="home-course-badge"
                        :class="teacherCourseStatus(course).tone"
                      >
                        {{ teacherCourseStatus(course).text }}
                      </span>
                    </td>
                    <td class="action-column">
                      <button
                        class="detail-action"
                        @click="select(course)"
                      >
                        查看详情
                        <AppIcon name="chevronRight" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div
              v-else
              class="dashboard-empty"
            >
              <AppIcon name="calendar" />
              <strong>今天暂无课程安排</strong>
              <p>新的排课会在刷新后显示。</p>
            </div>
            <div
              v-if="summary.today.length"
              class="today-summary"
            >
              <span>
                <i class="status-dot green" />
                已完成 {{ summary.todayCompleted }} 节
              </span>
              <span>
                <i class="status-dot blue" />
                未完成 {{ summary.todayPending }} 节
              </span>
              <span>已取消 {{ summary.todayCancelled }} 节</span>
            </div>
          </section>
          <section
            class="panel"
            aria-labelledby="recent-title"
          >
            <div class="dashboard-section-heading">
              <div><h2 id="recent-title">近期完成课程</h2></div>
              <span>近 30 天 · {{ home.data.recentCourses.length }} 节</span>
            </div>
            <div
              v-if="home.recentCourses.length"
              class="recent-records"
            >
              <button
                v-for="course in home.recentCourses"
                :key="course.bookingId"
                class="recent-record"
                @click="select(course)"
              >
                <span
                  class="avatar small"
                  :class="avatarClass(course.studentName)"
                >
                  {{ course.studentName.slice(0, 1) }}
                </span>
                <span class="record-course">
                  <strong>
                    {{ course.studentName }}
                    <span>{{ teacherCourseName(course) }}</span>
                  </strong>
                  <small>
                    {{ courseDate(course) }} · {{ shortTime(course.startTime) }}–{{
                      shortTime(course.endTime)
                    }}
                  </small>
                </span>
                <span class="record-duration">
                  {{ reportText(course.hasCourseReport) }}
                  <small>课程日报</small>
                </span>
                <span class="home-course-badge completed">已完成</span>
                <AppIcon name="chevronRight" />
              </button>
            </div>
            <div
              v-else
              class="dashboard-empty"
            >
              <AppIcon name="history" />
              <strong>近 30 天暂无已完成课程</strong>
              <p>课程状态更新为已完成后，将在这里展示。</p>
            </div>
          </section>
        </div>
        <div class="dashboard-secondary">
          <section
            class="next-lesson-panel"
            aria-labelledby="next-title"
          >
            <div class="next-heading">
              <h2 id="next-title">最近计划课程</h2>
              <span
                v-if="home.nextCourse"
                class="home-course-badge"
                :class="teacherCourseStatus(home.nextCourse).tone"
              >
                {{ teacherCourseStatus(home.nextCourse).text }}
              </span>
            </div>
            <template v-if="home.nextCourse">
              <div class="next-person">
                <span
                  class="avatar"
                  :class="avatarClass(home.nextCourse.studentName)"
                >
                  {{ home.nextCourse.studentName.slice(0, 1) }}
                </span>
                <div>
                  <h3>{{ home.nextCourse.studentName }}</h3>
                  <p>{{ teacherCourseName(home.nextCourse) }}</p>
                </div>
              </div>
              <div class="next-time">
                <AppIcon name="clock" />
                <span>
                  {{ courseDate(home.nextCourse) }}
                  <strong>
                    {{ shortTime(home.nextCourse.startTime) }}–{{
                      shortTime(home.nextCourse.endTime)
                    }}
                  </strong>
                </span>
              </div>
              <button
                class="primary full"
                @click="select(home.nextCourse)"
              >
                <AppIcon name="calendar" />
                查看课程信息
              </button>
            </template>
            <div
              v-else
              class="next-empty"
            >
              <AppIcon name="check" />
              <strong>未来 60 天暂无待授课程</strong>
              <span>以最新排课为准</span>
            </div>
          </section>
          <section
            class="panel weekly-panel"
            aria-labelledby="weekly-title"
          >
            <div class="dashboard-section-heading">
              <div><h2 id="weekly-title">本周教学进度</h2></div>
              <span>
                {{ formatDate(summary.days[0]?.date || home.date) }}–{{
                  formatDate(summary.days[6]?.date || home.date)
                }}
              </span>
            </div>
            <div class="weekly-content">
              <div class="weekly-progress-label">
                <span>已完成 {{ summary.weeklyCompleted }} / {{ summary.weeklyTotal }} 节</span>
                <strong>{{ completionPercent }}%</strong>
              </div>
              <div
                class="weekly-progress"
                role="progressbar"
                aria-label="本周课程完成比例"
                :aria-valuenow="completionPercent"
                :aria-valuemin="0"
                :aria-valuemax="100"
              >
                <span :style="{ width: `${completionPercent}%` }" />
              </div>
              <div
                class="week-chart"
                aria-label="本周每日排课和完成数量"
              >
                <div
                  v-for="day in summary.days"
                  :key="day.date"
                  class="week-day"
                  :class="{ today: day.date === home.date }"
                  :title="`${formatDate(day.date)}，排课 ${day.total} 节，完成 ${day.completed} 节`"
                >
                  <strong>{{ day.total }}</strong>
                  <div class="day-bar-track">
                    <span
                      v-if="day.total"
                      class="day-total-bar"
                      :style="{ height: `${(day.total / maxDayCount) * 100}%` }"
                    >
                      <i :style="{ height: `${(day.completed / day.total) * 100}%` }" />
                    </span>
                  </div>
                  <small>{{ dayName(day.date).slice(1) }}</small>
                </div>
              </div>
              <div class="chart-legend">
                <span>
                  <i class="status-dot blue-light" />
                  排课
                </span>
                <span>
                  <i class="status-dot green" />
                  已完成
                </span>
              </div>
              <div class="weekly-status">
                <span>
                  未完成
                  <strong>{{ summary.weeklyPending }}</strong>
                </span>
                <span>
                  已取消
                  <strong>{{ summary.weeklyCancelled }}</strong>
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
      <p class="home-updated">
        更新于 {{ home.updatedAt }} · 按计划日期汇总，完成数量以约课状态为准
      </p>
    </template>
    <dialog
      ref="detailDialog"
      class="home-detail-dialog"
      aria-label="课程信息"
      @click="closeDetailOnBackdrop"
    >
      <template v-if="selected">
        <div class="home-detail-heading">
          <div>
            <h2>{{ selected.studentName }} · 课程信息</h2>
            <p>{{ teacherCourseName(selected) }}</p>
          </div>
          <button
            class="icon-button"
            aria-label="关闭课程信息"
            @click="detailDialog?.close()"
          >
            <AppIcon name="close" />
          </button>
        </div>
        <dl class="home-detail-list">
          <div>
            <dt>排课编号</dt>
            <dd>{{ selected.bookingId }}</dd>
          </div>
          <div>
            <dt>计划上课</dt>
            <dd>{{ selected.startTime || '未提供' }}</dd>
          </div>
          <div>
            <dt>计划下课</dt>
            <dd>{{ selected.endTime || '未提供' }}</dd>
          </div>
          <div>
            <dt>约课状态</dt>
            <dd>{{ teacherCourseStatus(selected).text }}</dd>
          </div>
          <div>
            <dt>学管</dt>
            <dd>{{ selected.studyManagerName || '未提供' }}</dd>
          </div>
          <div>
            <dt>约课人</dt>
            <dd>{{ selected.bookingOperatorName || '未提供' }}</dd>
          </div>
          <div>
            <dt>课程日报</dt>
            <dd>{{ reportText(selected.hasCourseReport) }}</dd>
          </div>
          <div>
            <dt>课堂反馈</dt>
            <dd>{{ reportText(selected.hasClassFeedback) }}</dd>
          </div>
        </dl>
        <p class="home-detail-note">课程时间以最新排课为准。进入教室前，请检查摄像头与麦克风。</p>
        <button
          v-if="selected.startTime"
          class="primary full"
          @click="openSchedule(selected)"
        >
          在课表中查看
        </button>
        <button
          class="secondary full"
          @click="detailDialog?.close()"
        >
          关闭
        </button>
      </template>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import { useAuthStore } from '@/stores/auth'
import { useTeacherHomeStore } from '@/stores/teacherHome'
import type { TeacherCourse } from '@/types/teacherHome'
import { dayName, formatDate } from '@/utils/date'
import { avatarClass } from '@/utils/lesson'
import { teacherCourseName, teacherCourseStatus } from '@/utils/teacherHome'

const auth = useAuthStore()
const home = useTeacherHomeStore()
const router = useRouter()
const summary = computed(() => home.summary)
const greeting = computed(() => {
  const hour = Number(home.time.slice(0, 2))
  return hour < 12 ? '上午好' : hour < 18 ? '下午好' : '晚上好'
})
const completionPercent = computed(() =>
  summary.value.weeklyTotal
    ? Math.round((summary.value.weeklyCompleted / summary.value.weeklyTotal) * 100)
    : 0,
)
const maxDayCount = computed(() => Math.max(1, ...summary.value.days.map((day) => day.total)))
const metrics = computed(() => [
  {
    label: '今日课程',
    value: summary.value.today.length,
    unit: '节',
    note: `已完成 ${summary.value.todayCompleted} 节`,
    icon: 'calendar',
    tone: 'blue',
  },
  {
    label: '今日未完成',
    value: summary.value.todayPending,
    unit: '节',
    note: '待建课与已建课合计',
    icon: 'video',
    tone: 'orange',
  },
  {
    label: '本周已完成',
    value: summary.value.weeklyCompleted,
    unit: '节',
    note: `本周共安排 ${summary.value.weeklyTotal} 节`,
    icon: 'check',
    tone: 'green',
  },
  {
    label: '实际授课时长',
    value: '—',
    unit: '',
    note: '等待出勤与实际时长数据',
    icon: 'clock',
    tone: 'purple',
  },
])
const selected = ref<TeacherCourse>()
const detailDialog = ref<HTMLDialogElement>()
function closeDetailOnBackdrop(event: MouseEvent): void {
  const dialog = detailDialog.value
  if (!dialog || event.target !== dialog) return
  const bounds = dialog.getBoundingClientRect()
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
    dialog.close()
}
onMounted(() => {
  void home.load().catch(() => {
    /* 错误由 store 和页面展示。 */
  })
})
async function refresh(): Promise<void> {
  try {
    await home.load(true)
  } catch {
    /* 保留错误区及重试。 */
  }
}
async function select(course: TeacherCourse): Promise<void> {
  selected.value = course
  await nextTick()
  detailDialog.value?.showModal()
}
function shortTime(value: string | null): string {
  return value?.slice(11, 16) || '—'
}
function openSchedule(course: TeacherCourse): void {
  detailDialog.value?.close()
  void router.push({
    name: 'schedule',
    query: {
      tab: course.bookingStatus === 4 || course.bookingStatus === 3 ? 'records' : 'arrange',
      lesson: course.bookingId,
      date: course.startTime?.slice(0, 10),
    },
  })
}
function courseDate(course: TeacherCourse): string {
  return course.startTime ? formatDate(course.startTime.slice(0, 10)) : '日期待补充'
}
function reportText(value: boolean | null): string {
  return value === null ? '未提供' : value ? '已填写' : '未填写'
}
</script>

<style lang="less" scoped>
@import '@/styles/components/home.less';
</style>
