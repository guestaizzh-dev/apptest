<template>
  <div class="page-heading">
    <div>
      <h1>我的账号</h1>
      <p>查看教师身份与账号资料</p>
    </div>
  </div>
  <section class="panel profile-panel">
    <div class="person">
      <div class="avatar">{{ accountName.slice(0, 1) }}</div>
      <div>
        <strong>{{ accountName }}</strong>
        <p>账号资料 · 已登录</p>
      </div>
    </div>
    <div class="profile-item">
      <span>姓名</span>
      <strong>{{ accountName }}</strong>
    </div>
    <div class="profile-item">
      <span>账号身份</span>
      <strong>
        {{ auth.user?.roles.map((role) => role.name).join('、') || teaching.teacher.role }}
      </strong>
    </div>
    <div class="profile-item">
      <span>上课方式</span>
      <strong>1 对 1 在线教学</strong>
    </div>
    <div class="profile-item">
      <span>绑定手机号</span>
      <strong>{{ auth.user?.phone || '未提供' }}</strong>
    </div>
    <div class="profile-item">
      <span>客户端版本</span>
      <strong>归途智学 · PC 教师端</strong>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useTeachingStore } from '@/stores/teaching'
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

// 身份来自登录接口；课程演示资料不能覆盖实际登录身份。
const teaching = useTeachingStore()
const auth = useAuthStore()
const accountName = computed(() => auth.user?.userName || teaching.teacher.name)
</script>

<style lang="less" scoped>
@import '@/styles/components/profile.less';
</style>
