<template>
  <div
    class="stats"
    :class="{ compact }"
  >
    <div class="stat">
      <div class="stat-icon"><AppIcon name="calendar" /></div>
      <div>
        <div class="stat-label">所选周排课</div>
        <div class="stat-value">
          {{ teaching.initialized ? summary.total : '—' }}
          <small>节</small>
        </div>
      </div>
      <span class="stat-note">含已取消课程</span>
    </div>
    <div class="stat">
      <div class="stat-icon"><AppIcon name="check" /></div>
      <div>
        <div class="stat-label">所选周已完成</div>
        <div class="stat-value">
          {{ teaching.initialized ? summary.completed : '—' }}
          <small>节</small>
        </div>
      </div>
      <span class="stat-note">按排课最终状态统计</span>
    </div>
    <div class="stat">
      <div class="stat-icon"><AppIcon name="clock" /></div>
      <div>
        <div class="stat-label">所选周待授课</div>
        <div class="stat-value">
          {{ teaching.initialized ? summary.pending : '—' }}
          <small>节</small>
        </div>
      </div>
      <span class="stat-note">含待建课与已建课</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { useTeachingStore } from '@/stores/teaching'

const props = defineProps<{ date: string; compact?: boolean }>()
const teaching = useTeachingStore()

// 三个统计值均使用同一周范围；排课总数包含取消及未上课记录。
const summary = computed(() => teaching.weekSummary(props.date))
</script>

<style lang="less" scoped>
@import '@/styles/components/stats.less';
</style>
