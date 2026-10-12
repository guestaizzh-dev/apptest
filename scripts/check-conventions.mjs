import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'vue/compiler-sfc'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const issues = []
let componentCount = 0

function inspect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      inspect(filename)
      continue
    }
    if (!entry.name.endsWith('.vue')) continue

    componentCount++
    const source = fs.readFileSync(filename, 'utf8')
    const relative = path.relative(root, filename)
    const { descriptor, errors } = parse(source, { filename })
    if (errors.length) issues.push(`${relative}: Vue 组件解析失败`)

    const script = descriptor.scriptSetup ?? descriptor.script
    const template = descriptor.template
    const firstStyle = descriptor.styles[0]
    if (!template || !script || !firstStyle) {
      issues.push(`${relative}: 必须包含 template、script、style 三个区块`)
      continue
    }
    if (!(
      template.loc.start.offset < script.loc.start.offset &&
      script.loc.start.offset < firstStyle.loc.start.offset
    )) {
      issues.push(`${relative}: 区块顺序必须为 template → script → style`)
    }
    if (descriptor.styles.some((style) => style.lang !== 'less')) {
      issues.push(`${relative}: 样式必须声明 lang="less"`)
    }
  }
}

inspect(path.join(root, 'src'))
if (issues.length) {
  console.error(issues.join('\n'))
  process.exitCode = 1
} else {
  console.log(`已检查 ${componentCount} 个组件：区块顺序与 Less 声明均符合规范。`)
}
