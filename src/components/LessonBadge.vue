<template>
  <span
    class="badge"
    :class="status"
  >
    {{ STATUS_LABELS[status] }}
  </span>
</template>

<script setup lang="ts">
import { STATUS_LABELS } from '@/constants/teaching'
import type { LessonStatus } from '@/types/teaching'

// 所有页面共用状态名称，防止展示文案与业务枚举不一致。
defineProps<{ status: LessonStatus }>()
</script>

<style lang="less" scoped>
@import '@/styles/components/badge.less';
</style>
