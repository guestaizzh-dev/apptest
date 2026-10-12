<template>
  <div
    ref="workspaceElement"
    class="teaching-workspace"
    @toggle.capture="closeOtherMenus"
    :class="{ 'board-hidden': !visible, 'drawer-closed': !drawerOpen }"
  >
    <header class="document-bar">
      <details class="document-menu">
        <summary aria-label="课件管理">
          <span class="document-icon"><AppIcon name="document" /></span>
          <strong>{{ model ? boardLabel(model) : '课件与白板' }}</strong>
        </summary>
        <div class="document-menu-panel">
          <button
            :disabled="!enabled"
            @click="picker?.click()"
          >
            <AppIcon name="document" />
            上传课件
          </button>
          <button
            :disabled="!enabled"
            @click="newBoard"
          >
            <AppIcon name="book" />
            新建白板
          </button>
          <select
            v-if="state.models.length > 1"
            :value="state.currentId"
            :disabled="!enabled"
            aria-label="切换课件或白板"
            @change="switchBoard"
          >
            <option
              v-for="item in state.models"
              :key="item.uniqueID"
              :value="item.uniqueID"
            >
              {{ boardLabel(item) }}
            </option>
          </select>
          <button @click="emit('request-screen')">
            <AppIcon name="monitor" />
            共享教学窗口
          </button>
        </div>
      </details>
      <span
        v-if="live || state.busy"
        class="document-state"
      >
        {{ live ? '授课同步中' : '正在准备课件…' }}
      </span>
      <div class="document-window-actions">
        <button
          :aria-label="drawerOpen ? '收起课件页列表' : '展开课件页列表'"
          :aria-expanded="drawerOpen"
          :aria-controls="parentId + '-pages'"
          :title="drawerOpen ? '收起课件页列表' : '展开课件页列表'"
          @click="drawerOpen = !drawerOpen"
        >
          <AppIcon name="sidebar" />
        </button>
        <button
          :aria-label="focused ? '还原授课画面' : '放大授课画面'"
          :title="focused ? '还原授课画面' : '放大授课画面'"
          :aria-pressed="focused"
          @click="toggleFocus"
        >
          <AppIcon name="expand" />
        </button>
        <button
          aria-label="离开教室并返回课表"
          title="离开教室并返回课表"
          @click="emit('request-leave')"
        >
          <AppIcon name="close" />
        </button>
      </div>
      <input
        ref="picker"
        type="file"
        accept=".ppt,.pptx,.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.bmp,.txt"
        hidden
        @change="upload"
      />
    </header>
    <div class="document-body">
      <div
        :id="parentId + '-pages'"
        class="page-drawer"
        :aria-hidden="!drawerOpen"
        :inert="!drawerOpen"
      >
        <nav
          class="page-thumbnails"
          aria-label="课件页"
        >
          <button
            v-for="number in state.pageCount"
            :key="number"
            :class="{ selected: number === state.page }"
            :aria-current="number === state.page ? 'page' : undefined"
            :disabled="!enabled"
            @click="flip(number)"
          >
            <span>{{ number }}</span>
            <div class="thumbnail">
              <img
                v-if="state.thumbnails[number - 1]"
                :src="state.thumbnails[number - 1]"
                :alt="'第' + number + '页'"
              />
              <span v-else>
                课堂白板
                <br />
                {{ number }}
              </span>
            </div>
          </button>
          <span
            v-if="!state.pageCount"
            class="no-pages"
          >
            暂无课件
          </span>
        </nav>
      </div>
      <button
        class="drawer-handle"
        :aria-label="drawerOpen ? '收起课件抽屉' : '展开课件抽屉'"
        :aria-expanded="drawerOpen"
        :aria-controls="parentId + '-pages'"
        @click="drawerOpen = !drawerOpen"
      >
        <AppIcon :name="drawerOpen ? 'chevronLeft' : 'chevronRight'" />
      </button>
      <main class="canvas-stage">
        <div
          :id="parentId"
          class="superboard-view"
        ></div>
        <div
          v-if="!state.ready"
          class="board-empty"
        >
          <AppIcon name="book" />
          <h2>{{ state.busy ? '正在连接课堂白板' : '准备好，开始一节好课' }}</h2>
          <p>{{ state.message || '进入教室后，点击左上角课件名称上传PPT、PDF或打开白板。' }}</p>
        </div>
      </main>
      <aside
        class="tools-rail"
        aria-label="教学工具"
      >
        <div class="drawing-tools">
          <button
            v-for="item in tools"
            :key="item.value"
            :class="{ selected: tool === item.value }"
            :title="item.value === 64 ? '整笔擦除：当前 ZEGO SDK 不支持局部擦除' : item.label"
            :aria-pressed="tool === item.value"
            :disabled="!enabled"
            @click="selectTool(item.value)"
          >
            <AppIcon :name="item.icon" />
            <span>{{ item.label }}</span>
          </button>
          <details
            ref="shapeMenu"
            class="shape-tools"
          >
            <summary
              :class="{ selected: [4, 8, 16].includes(tool) }"
              :aria-disabled="!enabled"
              title="图形"
              @click="!enabled && $event.preventDefault()"
            >
              <AppIcon name="rectangle" />
              <span>图形</span>
            </summary>
            <div class="shape-tools-panel">
              <strong>拖动绘制</strong>
              <button
                v-for="shape in drawingShapes"
                :key="shape.value"
                :disabled="!enabled"
                :class="{ selected: tool === shape.value }"
                @click="selectTool(shape.value)"
              >
                <AppIcon :name="shape.icon" />
                {{ shape.label }}
              </button>
            </div>
          </details>
          <button
            :disabled="!enabled"
            title="新建课堂白板"
            @click="newBoard"
          >
            <AppIcon name="document" />
            <span>画板</span>
          </button>
          <details class="more-tools">
            <summary
              aria-label="更多教学工具"
              title="更多教学工具"
            >
              <AppIcon name="more" />
            </summary>
            <div class="more-tools-panel">
              <strong>笔迹设置</strong>
              <label>
                颜色
                <input
                  v-model="color"
                  type="color"
                  aria-label="笔迹颜色"
                  :disabled="!enabled"
                  @change="setColor"
                />
              </label>
              <label>
                粗细
                <select
                  v-model.number="lineWidth"
                  aria-label="笔迹粗细"
                  :disabled="!enabled"
                  @change="setWidth"
                >
                  <option :value="3">细</option>
                  <option :value="6">中</option>
                  <option :value="10">粗</option>
                </select>
              </label>
              <div class="editing-actions">
                <button
                  :disabled="!enabled"
                  @click="controller.command(() => controller.current()?.undo())"
                >
                  <AppIcon name="undo" />
                  <span>撤销</span>
                </button>
                <button
                  :disabled="!enabled"
                  @click="controller.command(() => controller.current()?.redo())"
                >
                  <AppIcon name="history" />
                  <span>重做</span>
                </button>
                <button
                  :disabled="!enabled"
                  @click="clear"
                >
                  <AppIcon name="clear" />
                  <span>清空</span>
                </button>
              </div>
              <button
                :disabled="!enabled"
                class="export-page"
                @click="download"
              >
                <AppIcon name="download" />
                导出当前页
              </button>
            </div>
          </details>
        </div>
      </aside>
    </div>
    <footer class="page-controls">
      <span
        v-if="state.busy || publishing || canPublish"
        class="file-help"
        :class="{ 'sync-live': live }"
        role="status"
      >
        {{
          publishing
            ? '正在同步授课内容…'
            : state.busy
              ? '课件处理中…'
              : live
                ? '授课同步中'
                : '未同步到学生 · 点击播放开始同步'
        }}
      </span>
      <div>
        <button
          :disabled="!enabled || state.page <= 1"
          aria-label="上一页"
          @click="flip(state.page - 1)"
        >
          <AppIcon name="previous" />
        </button>
        <button
          class="broadcast"
          :disabled="!live && (!enabled || publishing)"
          :aria-label="live ? '停止同步授课内容' : '同步授课内容到学生App'"
          :title="live ? '停止同步授课内容' : '同步授课内容到学生App'"
          :aria-pressed="live"
          @click="live ? emit('stop') : emit('publish')"
        >
          <AppIcon :name="live ? 'pause' : 'start'" />
        </button>
        <button
          :disabled="!enabled || state.page >= state.pageCount"
          aria-label="下一页"
          @click="flip(state.page + 1)"
        >
          <AppIcon name="next" />
        </button>
      </div>
      <span class="page-count">
        {{ state.pageCount ? state.page + '/' + state.pageCount : '—/—' }}
      </span>
    </footer>
    <p
      v-if="state.message && state.ready"
      class="board-message"
      role="status"
    >
      {{ state.message }}
    </p>
    <dialog
      ref="boardDialog"
      class="board-name-dialog"
      aria-label="新建白板"
      @cancel="state.busy && $event.preventDefault()"
    >
      <form @submit.prevent="createNamedBoard">
        <h2>新建白板</h2>
        <label for="new-board-name">白板名称</label>
        <input
          id="new-board-name"
          v-model="boardName"
          autofocus
          required
          maxlength="128"
          :disabled="state.busy"
          placeholder="例如：分数练习"
        />
        <p
          v-if="state.message"
          role="alert"
        >
          {{ state.message }}
        </p>
        <div>
          <button
            type="button"
            :disabled="state.busy"
            @click="boardDialog?.close()"
          >
            取消
          </button>
          <button
            type="submit"
            :disabled="state.busy"
          >
            {{ state.busy ? '创建中…' : '创建白板' }}
          </button>
        </div>
      </form>
    </dialog>
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import type { BoardState, SuperBoardController } from '@/services/superboard'
const props = defineProps<{
  controller: SuperBoardController
  state: BoardState
  parentId: string
  canPublish: boolean
  live: boolean
  publishing: boolean
  visible: boolean
}>()
const emit = defineEmits<{
  publish: []
  stop: []
  'request-screen': []
  'request-leave': []
  'focus-change': [focused: boolean]
}>()
const drawerOpen = ref(true)
const workspaceElement = ref<HTMLElement>()
function closeOtherMenus(event: Event): void {
  const opened = event.target
  if (!(opened instanceof HTMLDetailsElement) || !opened.open) return
  workspaceElement.value?.querySelectorAll<HTMLDetailsElement>('details[open]').forEach((menu) => {
    if (menu !== opened) menu.open = false
  })
}
function dismissMenus(event: PointerEvent | KeyboardEvent): void {
  if (boardDialog.value?.open) return
  if (event instanceof KeyboardEvent && event.key !== 'Escape') return
  workspaceElement.value?.querySelectorAll<HTMLDetailsElement>('details[open]').forEach((menu) => {
    if (
      event instanceof PointerEvent &&
      event.target instanceof Node &&
      menu.contains(event.target)
    )
      return
    menu.open = false
    if (event instanceof KeyboardEvent) menu.querySelector<HTMLElement>('summary')?.focus()
  })
}
const focused = ref(false)
function toggleFocus() {
  focused.value = !focused.value
  emit('focus-change', focused.value)
}
const picker = ref<HTMLInputElement>()
const model = computed(() =>
  props.state.models.find((item) => item.uniqueID === props.state.currentId),
)
const enabled = computed(() => props.canPublish && props.state.ready && !props.state.busy)
const tool = ref(32),
  color = ref('#ff4e35'),
  lineWidth = ref(6)
const tools = [
  { value: 32, icon: 'cursor', label: '选择' },
  { value: 1, icon: 'pen', label: '画笔' },
  { value: 64, icon: 'eraser', label: '橡皮' },
  { value: 2, icon: 'text', label: '文字' },
]
const shapeMenu = ref<HTMLDetailsElement>()
const boardDialog = ref<HTMLDialogElement>()
const boardName = ref('')
const drawingShapes = [
  { value: 4, icon: 'line', label: '直线' },
  { value: 8, icon: 'rectangle', label: '矩形' },
  { value: 16, icon: 'ellipse', label: '椭圆' },
]
function boardLabel(item: { name: string; uniqueID: string }) {
  return props.state.models.filter((board) => board.name === item.name).length > 1
    ? `${item.name} · ${props.state.models.findIndex((board) => board.uniqueID === item.uniqueID) + 1}`
    : item.name
}
function selectTool(value: number) {
  void props.controller.command(() => {
    if (!props.controller.manager?.setToolType(value)) return false
    tool.value = value
    if (shapeMenu.value) shapeMenu.value.open = false
  })
}
function setColor() {
  void props.controller.command(() => props.controller.manager?.setBrushColor(color.value))
}
function setWidth() {
  void props.controller.command(() => props.controller.manager?.setBrushSize(lineWidth.value))
}
function flip(number: number) {
  if (number >= 1 && number <= props.state.pageCount)
    void props.controller.command(() => props.controller.current()?.flipToPage(number))
}
function newBoard() {
  if (!enabled.value) return
  workspaceElement.value?.querySelectorAll<HTMLDetailsElement>('details[open]').forEach((menu) => {
    menu.open = false
  })
  boardName.value = props.controller.nextBoardName()
  boardDialog.value?.showModal()
}
async function createNamedBoard() {
  if (!enabled.value) return
  if (await props.controller.createBoard(boardName.value)) boardDialog.value?.close()
}
function switchBoard(event: Event) {
  const id = (event.target as HTMLSelectElement).value
  const menu = (event.target as HTMLElement).closest('details')
  if (menu) menu.open = false
  void props.controller.command(() =>
    props.controller.manager?.getSuperBoardView().switchSuperBoardSubView(id),
  )
}
function clear() {
  if (window.confirm('清空当前页全部批注？'))
    void props.controller.command(() => props.controller.current()?.clearCurrentPage())
}
function upload(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  input.value = ''
  workspaceElement.value?.querySelectorAll<HTMLDetailsElement>('details[open]').forEach((menu) => {
    menu.open = false
  })
  if (file) void props.controller.upload(file)
}
async function download() {
  await props.controller.command(async () => {
    const data = await props.controller.current()?.snapshot()
    if (!data) return
    const link = document.createElement('a')
    link.href = data.image.startsWith('data:') ? data.image : 'data:image/png;base64,' + data.image
    link.download = (model.value?.name || '课堂白板') + '-' + props.state.page + '.png'
    link.click()
  })
}
let observer: ResizeObserver | undefined, timer: ReturnType<typeof setTimeout> | undefined
function resize() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    props.controller.current()?.reloadView()
  }, 150)
}
onMounted(() => {
  document.addEventListener('pointerdown', dismissMenus)
  document.addEventListener('keydown', dismissMenus)
  observer = new ResizeObserver(resize)
  const parent = document.getElementById(props.parentId)
  if (parent) observer.observe(parent)
})
watch(
  () => props.visible,
  (visible) => {
    if (!visible && focused.value) {
      focused.value = false
      emit('focus-change', false)
    }
    resize()
  },
)
watch(drawerOpen, resize)
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', dismissMenus)
  document.removeEventListener('keydown', dismissMenus)
  observer?.disconnect()
  clearTimeout(timer)
})
</script>
<style lang="less" scoped>
@import '@/styles/components/teaching-board.less';
</style>
