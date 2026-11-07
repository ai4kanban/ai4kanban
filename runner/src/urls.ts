export const WEB_URL = () => (process.env.WILDCRANE_WEB_URL || 'https://app.wildcrane.ai').replace(/\/+$/, '')

export const taskUrl = (task: string) => `${WEB_URL()}/tasks/${encodeURIComponent(task)}`
