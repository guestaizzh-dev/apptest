<template>
  <template v-if="lessons.length">
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>日期</th>
            <th>学生</th>
            <th>课程</th>
            <th>计划时间</th>
            <th v-if="history">实际时长</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="lesson in lessons"
            :key="lesson.id"
            class="record-row"
            :class="{ selected: lesson.id === selectedId }"
            tabindex="0"
            :aria-label="`查看${lesson.student}${courseName(lesson)}${history ? '上课记录' : '课程详情'}`"
            @click="$emit('select', lesson)"
            @keydown.enter.self.prevent="$emit('select', lesson)"
            @keydown.space.self.prevent="$emit('select', lesson)"
          >
            <td>
              {{ lesson.date ? formatDate(lesson.date) : '日期待补充' }}
              <span class="table-muted">{{ lesson.date ? dayName(lesson.date) : '' }}</span>
            </td>
            <td>
              <div class="table-person">
                <div
                  class="avatar small"
                  :class="avatarClass(lesson.student)"
                >
                  {{ lesson.student.slice(0, 1) }}
                </div>
                <strong>{{ lesson.student }}</strong>
              </div>
            </td>
            <td>
              <strong>{{ courseName(lesson) }}</strong>
            </td>
            <td>{{ lesson.start }}–{{ lesson.end }}</td>
            <td v-if="history">
              {{ lesson.duration !== undefined ? `${lesson.duration} 分钟` : '—' }}
            </td>
            <td><LessonBadge :status="lesson.status" /></td>
            <td>
              <button
                v-if="canEnter(lesson)"
                class="row-action enter"
                @click.stop="$emit('enter', lesson)"
              >
                准备上课
              </button>
              <button
                v-else
                class="row-action"
                @click.stop="$emit('select', lesson)"
              >
                {{ history || isFinal(lesson) ? '查看记录' : '查看详情' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="list-footer">
      <span>共 {{ lessons.length }} {{ history ? '条记录' : '节课' }}</span>
      <span>{{ history ? '记录保留课程最终状态' : '与日 / 周课表使用同一份课程安排' }}</span>
    </div>
  </template>
  <div
    v-else
    class="empty"
  >
    <AppIcon name="calendar" />
    <strong>{{ history ? '暂无上课记录' : '暂无教学安排' }}</strong>
    <p>当前条件下没有课程，可以切换日期或调整筛选。</p>
    <button
      class="secondary"
      @click="$emit('reset')"
    >
      重置筛选
    </button>
  </div>
</template>

<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'
import LessonBadge from '@/components/LessonBadge.vue'
import type { Lesson, LessonId } from '@/types/teaching'
import { dayName, formatDate } from '@/utils/date'
import { avatarClass, canEnter, courseName, isFinal } from '@/utils/lesson'

// 教学安排与历史记录共用表格；筛选由父页面完成，表格只负责展示和选择。
defineProps<{ lessons: Lesson[]; selectedId?: LessonId | null; history?: boolean }>()
defineEmits<{ select: [lesson: Lesson]; enter: [lesson: Lesson]; reset: [] }>()
</script>

<style lang="less" scoped>
@import '@/styles/components/table.less';
</style>
