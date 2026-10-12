<template>
  <div class="login-page">
    <header class="login-header">
      <div class="login-brand">
        <span class="login-logo">
          <img
            src="/brand-logo.png"
            alt=""
          />
        </span>
        <span>
          归途智学
          <small>1 对 1 教学工作台</small>
        </span>
      </div>
      <span class="client-label">PC 教师端</span>
    </header>

    <main
      ref="mainElement"
      class="login-main"
    >
      <div
        ref="contentElement"
        class="login-content"
        :style="{ transform: `scale(${contentScale})` }"
      >
        <section
          class="login-intro"
          aria-labelledby="intro-title"
        >
          <span class="intro-eyebrow">
            <i />
            专注每一节好课
          </span>
          <h1 id="intro-title">
            教学有序，
            <br />
            成长有迹。
          </h1>
          <p class="intro-description">
            从课前安排到课后记录，
            <br />
            让每一次用心教学，都有清晰的回响。
          </p>

          <div
            class="schedule-illustration"
            aria-hidden="true"
          >
            <div class="illustration-top">
              <span class="illustration-icon"><AppIcon name="calendar" /></span>
              <strong>我的教学安排</strong>
              <span class="illustration-week">本周</span>
            </div>
            <div class="illustration-days">
              <span>一</span>
              <span>二</span>
              <span class="selected-day">三</span>
              <span>四</span>
              <span>五</span>
            </div>
            <div class="illustration-grid">
              <div class="illustration-line">
                <span>14:00</span>
                <i />
              </div>
              <div class="illustration-line">
                <span>15:00</span>
                <i />
              </div>
              <div class="illustration-line">
                <span>16:00</span>
                <i />
              </div>
              <div class="illustration-lesson">
                <span>1 对 1 专属课堂</span>
                <strong>把时间留给成长</strong>
                <small>14:00 — 14:50</small>
              </div>
              <div class="illustration-lesson secondary-lesson">
                <span>课后记录</span>
                <strong>每一步，都看得见</strong>
              </div>
            </div>
            <div class="illustration-complete">
              <span><AppIcon name="check" /></span>
              <div>
                <strong>每一节好课，都值得记录</strong>
                <small>安排 · 上课 · 记录</small>
              </div>
            </div>
          </div>
          <div class="intro-features">
            <span>
              <AppIcon name="calendar" />
              清晰排课
            </span>
            <span>
              <AppIcon name="video" />
              专注授课
            </span>
            <span>
              <AppIcon name="history" />
              成长记录
            </span>
          </div>
        </section>

        <section
          class="login-card"
          aria-labelledby="login-title"
        >
          <span class="card-eyebrow">欢迎回来</span>
          <h2 id="login-title">登录教师工作台</h2>
          <p class="card-description">使用教师账号绑定的手机号，通过密码或验证码登录。</p>
          <div
            class="login-methods"
            aria-label="登录方式"
          >
            <button
              v-for="method in loginMethods"
              :key="method.value"
              type="button"
              :class="{ active: loginType === method.value }"
              :aria-pressed="loginType === method.value"
              :disabled="auth.submitting || sendingCode"
              @click="switchLoginType(method.value)"
            >
              {{ method.label }}
            </button>
          </div>
          <form
            novalidate
            :aria-busy="auth.submitting"
            @submit.prevent="submit"
          >
            <div
              v-for="field in fields"
              :key="field.key"
              class="login-field"
            >
              <label :for="field.key">{{ field.label }}</label>
              <div
                class="input-wrap"
                :class="{ invalid: errors[field.key] }"
              >
                <AppIcon :name="field.icon" />
                <input
                  :id="field.key"
                  v-model="identity[field.key]"
                  :name="field.key"
                  :type="
                    field.key === 'password'
                      ? showPassword
                        ? 'text'
                        : 'password'
                      : field.key === 'phone'
                        ? 'tel'
                        : 'text'
                  "
                  :inputmode="field.key === 'password' ? 'text' : 'numeric'"
                  :autocomplete="field.autocomplete"
                  :placeholder="field.placeholder"
                  :maxlength="field.key === 'phone' ? 11 : field.key === 'password' ? 128 : 6"
                  :disabled="auth.submitting || sendingCode"
                  :aria-invalid="Boolean(errors[field.key])"
                  :aria-describedby="errors[field.key] ? `${field.key}-error` : undefined"
                  required
                  @input="clearError(field.key)"
                />
                <button
                  v-if="field.key === 'password'"
                  class="password-toggle"
                  type="button"
                  :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                  :aria-pressed="showPassword"
                  :disabled="auth.submitting"
                  @click="showPassword = !showPassword"
                >
                  {{ showPassword ? '隐藏' : '显示' }}
                </button>
                <button
                  v-if="field.key === 'smsCode'"
                  class="login-send-code"
                  type="button"
                  :disabled="auth.submitting || sendingCode || resendSeconds > 0"
                  @click="sendCode"
                >
                  {{
                    sendingCode
                      ? '发送中…'
                      : resendSeconds > 0
                        ? `${resendSeconds}s 后重发`
                        : '获取验证码'
                  }}
                </button>
              </div>
              <p
                v-if="errors[field.key]"
                :id="`${field.key}-error`"
                class="field-error"
              >
                {{ errors[field.key] }}
              </p>
            </div>
            <p
              v-if="errorMessage"
              class="login-error"
              role="alert"
            >
              {{ errorMessage }}
            </p>
            <div class="login-preferences">
              <label class="remember-login">
                <input
                  v-model="rememberLogin"
                  name="rememberLogin"
                  type="checkbox"
                  :disabled="auth.submitting"
                  @change="updateRememberPreference"
                />
                <span>记住账号</span>
              </label>
            </div>
            <button
              class="login-submit"
              type="submit"
              :disabled="auth.submitting || sendingCode"
            >
              <span
                v-if="auth.submitting"
                class="login-spinner"
              />
              <span>{{ auth.submitting ? '正在登录…' : '登录工作台' }}</span>
              <AppIcon
                v-if="!auth.submitting"
                name="arrowRight"
              />
            </button>
            <p class="login-help">无法登录时，请联系管理员核对教师账号。</p>
          </form>
          <div class="card-note">
            <AppIcon name="shield" />
            <span>仅限已配置教师角色的账号登录</span>
          </div>
        </section>
      </div>
    </main>
    <footer class="login-footer">归途智学 · 让教学更有章法，让成长更有方向</footer>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import {
  clearRememberedLogin,
  readRememberedLogin,
  saveRememberedLogin,
} from '@/services/loginPreferences'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import type { LoginIdentity, LoginType } from '@/types/auth'
import { requestLoginSmsCode } from '@/api/auth'
import { safeLoginRedirect } from '@/utils/auth'

const auth = useAuthStore()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()
const mainElement = ref<HTMLElement | null>(null)
const contentElement = ref<HTMLElement | null>(null)
const contentScale = ref(1)
let sizeObserver: ResizeObserver | undefined

function fitContent(): void {
  const main = mainElement.value
  const content = contentElement.value
  if (!main || !content || !content.offsetHeight) return
  const style = getComputedStyle(main)
  const availableHeight =
    main.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
  // 使用未缩放的布局高度计算，错误提示和窗口缩放也能自动重新适配。
  contentScale.value = Math.min(1, Math.max(0, availableHeight - 16) / content.offsetHeight)
}

onMounted(() => {
  fitContent()
  sizeObserver = new ResizeObserver(fitContent)
  if (mainElement.value) sizeObserver.observe(mainElement.value)
  if (contentElement.value) sizeObserver.observe(contentElement.value)
})

let resendTimer: ReturnType<typeof setInterval> | undefined
let disposed = false
onBeforeUnmount(() => {
  disposed = true
  sizeObserver?.disconnect()
  clearInterval(resendTimer)
})

const rememberedIdentity = readRememberedLogin()
const loginType = ref<LoginType>(rememberedIdentity?.loginType ?? 'PASSWORD')
const loginMethods: { value: LoginType; label: string }[] = [
  { value: 'PASSWORD', label: '账号密码登录' },
  { value: 'CODE', label: '手机号验证码登录' },
]
const identity = reactive({ phone: rememberedIdentity?.phone ?? '', password: '', smsCode: '' })
const sendingCode = ref(false)
const showPassword = ref(false)
const resendSeconds = ref(0)
const rememberLogin = ref(Boolean(rememberedIdentity))
const errors = reactive({ phone: '', password: '', smsCode: '' })
const { errorMessage } = storeToRefs(auth)
watch(
  errorMessage,
  (message) => {
    if (message) ui.notify(message, 'top')
  },
  { immediate: true },
)
const fields = computed<
  {
    key: keyof typeof identity
    label: string
    icon: string
    autocomplete: string
    placeholder: string
  }[]
>(() => [
  {
    key: 'phone',
    label: loginType.value === 'PASSWORD' ? '账号（绑定手机号）' : '手机号',
    icon: 'phone',
    autocomplete: loginType.value === 'PASSWORD' ? 'username' : 'tel',
    placeholder: '请输入账号绑定的手机号',
  },
  loginType.value === 'PASSWORD'
    ? {
        key: 'password',
        label: '密码',
        icon: 'shield',
        autocomplete: 'current-password',
        placeholder: '请输入密码',
      }
    : {
        key: 'smsCode',
        label: '验证码',
        icon: 'shield',
        autocomplete: 'one-time-code',
        placeholder: '请输入 6 位验证码',
      },
])

function clearError(key: keyof typeof identity): void {
  errors[key] = ''
  errorMessage.value = ''
}

function switchLoginType(value: LoginType): void {
  if (loginType.value === value || auth.submitting || sendingCode.value) return
  loginType.value = value
  identity.password = ''
  showPassword.value = false
  identity.smsCode = ''
  errors.phone = errors.password = errors.smsCode = ''
  errorMessage.value = ''
}

async function sendCode(): Promise<void> {
  if (sendingCode.value || auth.submitting || resendSeconds.value > 0) return
  identity.phone = identity.phone.trim()
  if (!/^1\d{10}$/.test(identity.phone)) {
    errors.phone = '请输入以 1 开头的 11 位手机号。'
    ui.notify(errors.phone, 'top')
    document.getElementById('phone')?.focus()
    return
  }
  clearError('phone')
  sendingCode.value = true
  try {
    const result = await requestLoginSmsCode(identity.phone)
    if (disposed) return
    identity.smsCode = ''
    ui.notify('验证码已发送，请查看手机短信。')
    const deadline = Date.now() + result.resendAfterSeconds * 1000
    clearInterval(resendTimer)
    const updateCountdown = () => {
      resendSeconds.value = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      if (!resendSeconds.value) clearInterval(resendTimer)
    }
    if (result.resendAfterSeconds > 0) resendTimer = setInterval(updateCountdown, 1000)
    updateCountdown()
  } catch (error) {
    if (!disposed)
      ui.notify(error instanceof Error ? error.message : '验证码发送失败，请稍后重试。', 'top')
  } finally {
    sendingCode.value = false
  }
}

function updateRememberPreference(): void {
  if (!rememberLogin.value && !clearRememberedLogin())
    ui.notify('浏览器无法清除已保存的登录信息，请检查浏览器存储设置。', 'top')
}

async function submit(): Promise<void> {
  if (auth.submitting || sendingCode.value) return
  errorMessage.value = ''
  for (const field of fields.value) {
    if (field.key !== 'password') identity[field.key] = identity[field.key].trim()
    errors[field.key] = identity[field.key] ? '' : `请输入${field.label}。`
  }
  if (identity.phone && !/^1\d{10}$/.test(identity.phone))
    errors.phone = '请输入以 1 开头的 11 位手机号。'
  if (loginType.value === 'CODE' && identity.smsCode && !/^\d{6}$/.test(identity.smsCode))
    errors.smsCode = '请输入 6 位数字验证码。'
  const invalid = fields.value.find((field) => errors[field.key])
  if (invalid) {
    ui.notify(errors[invalid.key], 'top')
    await nextTick()
    document.getElementById(invalid.key)?.focus()
    return
  }
  try {
    const credentials: LoginIdentity =
      loginType.value === 'PASSWORD'
        ? { phone: identity.phone, loginType: 'PASSWORD', password: identity.password }
        : { phone: identity.phone, loginType: 'CODE', smsCode: identity.smsCode }
    await auth.login(credentials)
    // 仅记住已经验证成功的登录信息，失败时保留上次成功的记录。
    if (rememberLogin.value && !saveRememberedLogin(credentials)) {
      rememberLogin.value = false
      ui.notify('浏览器无法保存登录信息，下次登录需重新输入。', 'top')
    } else if (!rememberLogin.value && !clearRememberedLogin()) {
      ui.notify('浏览器无法清除已保存的登录信息，请检查浏览器存储设置。', 'top')
    }
    await router.replace(safeLoginRedirect(route.query.redirect))
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '登录失败，请稍后重试。'
  }
}
</script>

<style lang="less" scoped>
@import '@/styles/components/login.less';
</style>
