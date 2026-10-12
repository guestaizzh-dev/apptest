<template>
  <section class="panel empty">
    <AppIcon name="calendar" />
    <h1>页面不存在</h1>
    <p>请从左侧导航选择已开放的页面。</p>
    <RouterLink
      class="secondary"
      to="/"
    >
      返回首页
    </RouterLink>
  </section>
</template>

<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'
</script>

<style lang="less" scoped>
// 404 页面保留工作台外壳，不参与业务动态路由的清理。
.secondary {
  width: fit-content;
}
</style>
