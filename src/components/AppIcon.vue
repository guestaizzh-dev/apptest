<template>
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path :d="paths[name] || paths.calendar" />
  </svg>
</template>

<script setup lang="ts">
defineProps<{ name: string }>()
// 图标路径集中维护；此组件只渲染图标，不携带业务行为。
const paths: Record<string, string> = {
  classroomBrand:
    'M12 6C9 2 5 2 2 4v15c4-1 7 0 10 3 3-3 6-4 10-3V4c-3-2-7-2-10 2ZM12 6v16M4 7c2 0 4 1 6 3M14 10c2-2 4-3 6-3',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  expand: 'M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5',
  sidebar: 'M3 4h18v16H3ZM8 4v16',
  start: 'M8 5v14l11-7Z',
  pause: 'M7 5h3v14H7Zm7 0h3v14h-3Z',
  book: 'M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1ZM12 5v15',
  document: 'M6 2h8l5 5v15H5V2Zm8 0v6h5M8 12h8M8 16h8',
  monitor: 'M3 4h18v13H3ZM12 17v4m-5 0h10',
  settings:
    'm9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3Zm6 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  hangup: 'M3 12c5-5 13-5 18 0v5h-5v-4a13 13 0 0 0-8 0v4H3Z',
  cursor: 'M5 3v17l5-5 4 7 3-2-4-7 7-1Z',
  pen: 'm4 16 12-12 4 4L8 20l-5 1ZM14 6l4 4',
  eraser: 'm3 14 10-11 8 8-9 10H9Zm4-4 9 8M12 21h10',
  text: 'M4 4h16M12 4v17M8 21h8',
  rectangle: 'M4 4h16v16H4Z',
  line: 'M4 20 20 4',
  ellipse: 'M22 12a10 7 0 1 1-20 0 10 7 0 0 1 20 0Z',
  circle: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  triangle: 'M12 3 22 21H2Z',
  diamond: 'M12 2 22 12 12 22 2 12Z',
  undo: 'M3 4v7h7M3 11c5-10 18-6 18 3 0 4-3 7-7 7',
  clear: 'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
  previous: 'M5 5v14m14-14L8 12l11 7Z',
  next: 'M19 5v14M5 5l11 7-11 7Z',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  home: 'm3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9',
  calendar:
    'M6 5h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3ZM7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2',
  user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2',
  badge: 'M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2ZM8 3v3m8-3v3M8 11h2m4 0h2M8 15h8',
  phone: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2ZM10 5h4m-3 14h2',
  arrowRight: 'M4 12h16m-6-6 6 6-6 6',
  shield: 'm12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Zm-4 9 3 3 5-5',
  info: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 11v6m0-10v.1',
  bell: 'M18 8a6 6 0 0 0-12 0c0 8-3 8-3 10h18c0-2-3-2-3-10M10 21h4',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2',
  check: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-13 0 3 3 5-6',
  history: 'M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2',
  chevronLeft: 'm14 6-6 6 6 6',
  chevronRight: 'm10 6 6 6-6 6',
  search: 'M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0ZM16 16l5 5',
  video: 'M5 5h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Zm11 5 6-4v12l-6-4',
  play: 'M5 5h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Zm11 5 6-4v12l-6-4M7 9l5 3-5 3Z',
  mic: 'M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8',
  close: 'm6 6 12 12M6 18 18 6',
  speaker: 'M3 9h4l5-4v14l-5-4H3Zm13-2a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16',
}
</script>

<style lang="less" scoped>
svg {
  display: block;
  flex-shrink: 0;
}
</style>
