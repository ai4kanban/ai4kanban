import { readLanguage } from '../machine/settings'
import type { Language } from '../machine/types'

export const LANGUAGE_ENV = 'AI4KANBAN_LANGUAGE'
export const LANGUAGE_LINE_ENV = 'AI4KANBAN_LANGUAGE_LINE'

export const SYSTEM_LANGUAGE_ZH = '用中文回复。给任务创建者看的用中文，工作流的最终产物沿用项目语言。'
export const SYSTEM_LANGUAGE_EN = "Reply in English. Write for the task creator in English; the workflow's final artifacts follow the project's language."

// 仅识别平台曾注入的完整段落，Cloud 旧语言行另行兼容。
const systemLanguages = new Set([
  SYSTEM_LANGUAGE_ZH,
  SYSTEM_LANGUAGE_EN,
  '无论对话里的卡片、代码和贴进来的内容是什么语言，回复和写下的内容都用中文。代码、命令、文件名和字段名保持原文。',
  '对话和解释使用中文；产物使用用户明确指定的语言，否则使用所属 agent 明确指定的语言，均未指定时使用中文。代码、命令、文件名和字段名保持原文。',
  'Use English for conversation and explanations. For artifacts, use the language explicitly specified by the user, otherwise the responsible agent, otherwise English. Keep code, commands, filenames, and field names unchanged.',
])

export const isSystemLanguage = (text: string): boolean => systemLanguages.has(text)

const legacy = new Map<string, Language>([
  ['请用中文回复和写作。', 'zh'],
  ['Reply and write in English.', 'en'],
])

export const languageCode = (value: unknown): Language | null => value === 'zh' || value === 'en' ? value : null
export const legacyLanguage = (line: unknown): Language | null => typeof line === 'string' ? legacy.get(line) ?? null : null

export function runLanguage(): Language | null {
  if (process.env[LANGUAGE_ENV] !== undefined) return languageCode(process.env[LANGUAGE_ENV])
  if (process.env[LANGUAGE_LINE_ENV] !== undefined) return legacyLanguage(process.env[LANGUAGE_LINE_ENV])
  return readLanguage()
}

export const translating = (): boolean => runLanguage() === 'zh'
export const systemLanguage = (language: Language | null): string => language === 'zh' ? SYSTEM_LANGUAGE_ZH : language === 'en' ? SYSTEM_LANGUAGE_EN : ''

interface LanguageInput {
  language?: Language | null
  languageLine?: string
  prompt: string
  test?: boolean
  flow?: unknown
  review?: unknown
  agent?: unknown
}

export function cloudLanguage(input: LanguageInput): Language | null {
  if (input.test) return null
  return 'language' in input ? languageCode(input.language) : legacyLanguage(input.languageLine)
}

/** 仅旧 Cloud 的普通作业会自动追加这一段；正文中的相同文字保留。 */
export function cloudPrompt(input: LanguageInput): string {
  if ('language' in input || input.test || input.flow || input.review || input.agent || !legacyLanguage(input.languageLine)) return input.prompt
  if (input.prompt === input.languageLine) return ''
  const suffix = `\n\n${input.languageLine}`
  return input.prompt.endsWith(suffix) ? input.prompt.slice(0, -suffix.length) : input.prompt
}
