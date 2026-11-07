import path from 'node:path'

export function selectTests(files, args) {
  const names = []
  const nodeArgs = []
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--test-name-pattern') {
      if (!args[i + 1]) throw new Error('--test-name-pattern 缺少正则表达式')
      nodeArgs.push(arg, args[++i])
    } else if (arg.startsWith('--test-name-pattern=')) {
      nodeArgs.push(arg)
    } else if (arg.startsWith('-')) {
      throw new Error(`不支持的测试参数：${arg}`)
    } else {
      const name = path.basename(arg).replace(/(?:\.test)?\.(?:ts|mjs)$/, '').replace(/\.test$/, '')
      const file = `${name}.test.ts`
      if (!files.includes(file)) throw new Error(`找不到测试文件：${arg}`)
      names.push(file)
    }
  }
  return { tests: names.length ? [...new Set(names)] : files, nodeArgs }
}
