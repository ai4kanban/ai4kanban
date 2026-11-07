import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)

export function openBrowser(url: string): Promise<boolean> {
  const [command, args] = process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]] : ['xdg-open', [url]]
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore' })
    child.once('error', () => resolve(false))
    child.once('spawn', () => { child.unref(); resolve(true) })
  })
}

/** 取消只返回空值；缺少系统组件时保留当前目录入口。 */
export async function pickFolder(): Promise<string | null> {
  try {
    const [command, args] = process.platform === 'darwin'
      ? ['osascript', ['-e', 'POSIX path of (choose folder with prompt "WildCrane")']]
      : process.platform === 'win32'
        ? ['powershell.exe', ['-NoProfile', '-STA', '-Command', 'Add-Type -AssemblyName System.Windows.Forms; $picker = New-Object System.Windows.Forms.FolderBrowserDialog; if ($picker.ShowDialog() -eq "OK") { $picker.SelectedPath }']]
        : ['zenity', ['--file-selection', '--directory', '--title=WildCrane']]
    const result = await exec(command, args, { timeout: 120_000, maxBuffer: 64 * 1024 })
    return result.stdout.trim() || null
  } catch (error) {
    const held = error as { code?: number | string; stderr?: string }
    if ((process.platform === 'linux' && held.code === 1) || held.stderr?.includes('(-128)')) return null
    throw new Error('picker_unavailable')
  }
}
