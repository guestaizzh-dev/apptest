<template>
  <section
    ref="classroomElement"
    class="rtc-classroom"
    :class="{ 'content-focused': contentFocused }"
    :aria-busy="busy"
  >
    <header
      ref="bannerElement"
      v-show="!contentFocused"
      class="classroom-banner"
    >
      <div
        class="classroom-brand"
        role="img"
        aria-label="学而规途"
      ></div>
      <div class="banner-videos">
        <div class="banner-video">
          <div
            :ref="localRef"
            class="rtc-video"
          ></div>
          <div
            v-if="(!active && !busy) || !snapshot.videoEnabled"
            class="video-placeholder"
          >
            <AppIcon name="video" />
            <span>{{ !active && !busy ? '老师画面' : '摄像头已关闭' }}</span>
          </div>
        </div>
        <div class="banner-video student-video">
          <div
            v-for="participant in snapshot.participants"
            :key="participant.streamId"
            class="participant-video"
          >
            <div
              :ref="(element) => remoteRef(participant.streamId, element)"
              class="rtc-video"
            ></div>
            <span
              v-if="!participant.playing"
              class="remote-wait"
            >
              正在连接…
            </span>
          </div>
          <div
            v-if="!snapshot.participants.length"
            class="video-placeholder"
          >
            <AppIcon name="user" />
            <span>{{ studentName || '学生' }} · 等待进入</span>
          </div>
        </div>
      </div>
      <div class="banner-actions">
        <div class="banner-controls">
          <button
            v-if="!active"
            class="join-class"
            :disabled="busy || ending || !bookingId || closed"
            @click="connect()"
          >
            {{
              closed
                ? '课堂已结束'
                : busy
                  ? '正在连接…'
                  : snapshot.phase === 'error'
                    ? '重新连接'
                    : '进入教室'
            }}
          </button>
          <button
            title="设备设置"
            aria-label="设备设置"
            :aria-expanded="settingsOpen"
            @click="togglePopover('settings')"
          >
            <AppIcon name="settings" />
          </button>
          <button
            :title="fullscreen ? '退出全屏' : '课堂全屏'"
            aria-label="切换课堂全屏"
            @click="toggleFullscreen"
          >
            <AppIcon name="monitor" />
          </button>
          <button
            title="本节课程与师生"
            aria-label="本节课程与师生"
            :aria-expanded="informationOpen"
            @click="togglePopover('information')"
          >
            <AppIcon name="user" />
          </button>
          <button
            :disabled="!active"
            :class="{ off: !snapshot.audioEnabled }"
            :title="snapshot.audioEnabled ? '关闭麦克风' : '打开麦克风'"
            aria-label="麦克风"
            :aria-pressed="snapshot.audioEnabled"
            @click="session.toggleAudio()"
          >
            <AppIcon name="mic" />
          </button>
          <button
            class="end-class"
            title="结束整节课堂"
            aria-label="结束课堂"
            :disabled="!active || ending || closed"
            @click="emit('request-close')"
          >
            <AppIcon name="hangup" />
          </button>
        </div>
        <span
          v-if="snapshot.phase === 'error' || snapshot.phase === 'reconnecting'"
          class="connection-status"
          :class="snapshot.phase"
        >
          <i></i>
          {{ phaseText }}
        </span>
      </div>
      <div
        v-if="settingsOpen"
        class="classroom-popover"
      >
        <strong>课堂设备</strong>
        <button
          :disabled="!active"
          @click="session.toggleAudio()"
        >
          麦克风：{{ snapshot.audioEnabled ? '已开' : '静音' }}
        </button>
        <button
          :disabled="!active"
          @click="session.toggleVideo()"
        >
          摄像头：{{ snapshot.videoEnabled ? '已开' : '关闭' }}
        </button>
        <button
          :disabled="!active"
          @click="session.toggleSpeaker()"
        >
          扬声器：{{ snapshot.speakerEnabled ? '已开' : '静音' }}
        </button>
        <button
          :disabled="snapshot.leaving || ending"
          @click="emit('request-leave')"
        >
          离开教室
        </button>
        <button @click="settingsOpen = false">收起</button>
      </div>
      <div
        v-if="informationOpen"
        class="classroom-popover course-popover"
      >
        <strong>本节课程 · {{ snapshot.participants.length }} 位学生在线</strong>
        <slot name="information"></slot>
        <button @click="informationOpen = false">收起</button>
      </div>
    </header>
    <TeachingBoard
      :visible="mode === 'board'"
      :controller="board"
      :state="boardState"
      :parent-id="boardId"
      :can-publish="active && !ending"
      :live="snapshot.sharing && mode === 'board'"
      :publishing="mirrorPreparing || (snapshot.shareBusy && mode === 'board')"
      @publish="publishBoard"
      @stop="session.stopSharing()"
      @request-screen="chooseMode('screen')"
      @request-leave="emit('request-leave')"
      @focus-change="contentFocused = $event"
    />
    <div
      v-show="mode === 'screen'"
      class="screen-workspace"
    >
      <header class="screen-document-bar">
        <button
          class="return-board"
          @click="chooseMode('board')"
        >
          <AppIcon name="chevronLeft" />
          课件与白板
        </button>
        <AppIcon name="monitor" />
        <strong>授课窗口</strong>
        <button
          :disabled="!active || snapshot.shareBusy"
          @click="snapshot.sharing ? session.stopSharing() : session.startSharing()"
        >
          {{ snapshot.sharing ? '停止共享' : '选择授课窗口' }}
        </button>
      </header>
      <div class="screen-stage">
        <div
          :ref="screenRef"
          class="rtc-video"
          :class="{ invisible: !snapshot.sharing }"
        ></div>
        <div
          v-if="!snapshot.sharing"
          class="screen-empty"
        >
          <AppIcon name="monitor" />
          <h2>{{ snapshot.shareBusy ? '请选择要共享的窗口' : '共享 PPT、PDF 或教学网页' }}</h2>
          <p>建议选择课件放映窗口，让学生清楚看到教学内容。</p>
          <button
            :disabled="!active || snapshot.shareBusy"
            @click="session.startSharing()"
          >
            选择授课窗口
          </button>
        </div>
      </div>
    </div>
    <p
      v-if="snapshot.message || snapshot.leaveError"
      class="rtc-message"
      :role="snapshot.phase === 'error' || snapshot.leaveError ? 'alert' : 'status'"
    >
      {{ snapshot.leaveError || snapshot.message }}
      <button
        v-if="snapshot.leaveError"
        :disabled="snapshot.leaving"
        @click="leave"
      >
        重试离课
      </button>
    </p>
  </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import TeachingBoard from '@/components/TeachingBoard.vue'
import { SuperBoardController, initialBoardState } from '@/services/superboard'
import { ClassroomSession, initialClassroomSnapshot } from '@/services/classroom'
import type { ClassroomAttendance, ClassroomSnapshot, RtcPhase } from '@/types/rtc'
import { sessionToken } from '@/services/session'

const props = withDefaults(
  defineProps<{
    courseTitle?: string
    bookingId?: number | string
    studentName?: string
    teacherName?: string
    disabledMessage?: string
    ending?: boolean
    closed?: boolean
  }>(),
  { teacherName: '老师', disabledMessage: '此课程尚未绑定真实排课，请先选择真实排课。' },
)
const emit = defineEmits<{
  'state-change': [snapshot: ClassroomSnapshot]
  'request-close': []
  'request-leave': []
  left: [attendance?: ClassroomAttendance]
}>()
const snapshot = shallowRef(initialClassroomSnapshot())
const boardState = shallowRef(initialBoardState())
const boardId = 'zego-board-' + crypto.randomUUID()
const board = new SuperBoardController((state) => {
  boardState.value = state
}, boardId)
const session = new ClassroomSession(
  (state) => {
    snapshot.value = state
    emit('state-change', state)
    if (!state.sharing && !state.shareBusy && !mirrorPreparing.value) board.stopMirror()
  },
  undefined,
  board,
)
const active = computed(() => ['connected', 'reconnecting'].includes(snapshot.value.phase))
const busy = computed(
  () => snapshot.value.leaving || ['joining', 'publishing'].includes(snapshot.value.phase),
)
const labels: Record<RtcPhase, string> = {
  idle: '课前准备',
  joining: '正在加入',
  publishing: '正在发布音视频',
  connected: '音视频已连接',
  reconnecting: '正在重连',
  error: '连接失败',
}
const phaseText = computed(() => labels[snapshot.value.phase])
watch(
  () => props.bookingId,
  () => {
    leave()
  },
)
watch(
  sessionToken,
  (token, previous) => {
    if (token !== previous) leave()
  },
  { flush: 'sync' },
)
onBeforeUnmount(() => {
  leave()
})

function screenRef(element: Element | ComponentPublicInstance | null): void {
  session.attachScreen(element instanceof HTMLElement ? element : undefined)
}
function localRef(element: Element | ComponentPublicInstance | null): void {
  session.attachLocal(element instanceof HTMLElement ? element : undefined)
}
function remoteRef(streamId: string, element: Element | ComponentPublicInstance | null): void {
  session.attachRemote(streamId, element instanceof HTMLElement ? element : undefined)
}
async function connect(): Promise<void> {
  if (!props.bookingId || busy.value || props.closed || props.ending) return
  if (!window.isSecureContext) {
    snapshot.value = {
      ...snapshot.value,
      phase: 'error',
      message: '摄像头与麦克风需要 HTTPS 或 localhost 环境。',
    }
    emit('state-change', snapshot.value)
    return
  }
  await session.connect(props.bookingId, props.teacherName)
}
async function disconnect(): Promise<ClassroomAttendance | undefined> {
  const attendance = await session.disconnect()
  emit('left', attendance)
  return attendance
}
function leave(): void {
  void disconnect().catch(() => {
    /* snapshot.leaveError 提供明确重试入口。 */
  })
}
defineExpose({ disconnect })

const mode = ref<'board' | 'screen'>('board')
const contentFocused = ref(false)
const mirrorPreparing = ref(false)
const settingsOpen = ref(false)
const informationOpen = ref(false)
const bannerElement = ref<HTMLElement>()
function togglePopover(kind: 'settings' | 'information'): void {
  if (kind === 'settings') {
    settingsOpen.value = !settingsOpen.value
    informationOpen.value = false
  } else {
    informationOpen.value = !informationOpen.value
    settingsOpen.value = false
  }
}
function dismissPopover(event: PointerEvent | KeyboardEvent): void {
  if (!settingsOpen.value && !informationOpen.value) return
  if (event instanceof KeyboardEvent) {
    if (event.key !== 'Escape') return
    const label = settingsOpen.value ? '设备设置' : '本节课程与师生'
    bannerElement.value?.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)?.focus()
  } else if (
    event.target instanceof Element &&
    bannerElement.value?.contains(event.target) &&
    event.target.closest(
      '.classroom-popover, [aria-label="设备设置"], [aria-label="本节课程与师生"]',
    )
  )
    return
  settingsOpen.value = false
  informationOpen.value = false
}
const classroomElement = ref<HTMLElement>()
const fullscreen = ref(false)
function syncFullscreen() {
  fullscreen.value = Boolean(document.fullscreenElement)
}
onMounted(() => document.addEventListener('fullscreenchange', syncFullscreen))
onBeforeUnmount(() => document.removeEventListener('fullscreenchange', syncFullscreen))
onMounted(() => {
  document.addEventListener('pointerdown', dismissPopover)
  document.addEventListener('keydown', dismissPopover)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', dismissPopover)
  document.removeEventListener('keydown', dismissPopover)
})
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await classroomElement.value?.requestFullscreen()
  } catch {
    snapshot.value = { ...snapshot.value, message: '浏览器未允许全屏，请使用窗口最大化。' }
  }
}
function chooseMode(next: 'board' | 'screen') {
  if (mode.value === next) return
  session.stopSharing()
  board.stopMirror()
  contentFocused.value = false
  mode.value = next
}
async function publishBoard() {
  if (!active.value || mirrorPreparing.value || snapshot.value.shareBusy || snapshot.value.sharing)
    return
  mirrorPreparing.value = true
  try {
    const source = await board.createMirror()
    if (!active.value || mode.value !== 'board') {
      source.getTracks().forEach((track) => track.stop())
      board.stopMirror()
      return
    }
    await session.startSharing(source)
  } catch (error) {
    snapshot.value = {
      ...snapshot.value,
      message: error instanceof Error ? error.message : '白板同步失败，请重试。',
    }
  } finally {
    mirrorPreparing.value = false
    if (!snapshot.value.sharing && !snapshot.value.shareBusy) board.stopMirror()
  }
}
</script>
<style lang="less" scoped>
@import '@/styles/components/realtime-classroom.less';
</style>
