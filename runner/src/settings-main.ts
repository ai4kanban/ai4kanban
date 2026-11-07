// 新版 Runner 包提供的设置页：宿主在本机有更新的 Runner 时启动它，断开即关闭。

import { useRunnerHome } from './home'
import { settingsAction } from './settings'
import { closeSettings, openSettings, ownsSettings } from './settings-server'

useRunnerHome()
process.on('disconnect', () => void closeSettings().then(() => process.exit(0)))
openSettings(settingsAction, {}, false).then(() => {
  process.send?.({ type: 'settings-ready' })
  if (!ownsSettings() || !process.connected) void closeSettings().then(() => process.exit(0))
}, () => process.exit(1))
