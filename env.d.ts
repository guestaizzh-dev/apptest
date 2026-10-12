/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_USE_MOCK_API?: string
  readonly VITE_AUTH_BASE_URL?: string
  readonly VITE_API_PROXY_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  classroomCapture?: {
    prepare(): Promise<void>
    cancel(): Promise<void>
  }
}
