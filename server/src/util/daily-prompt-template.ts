import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

interface PromptUser {
  tag: string
  name?: string
  hobbies?: string
  city?: string
}

interface WritingVariable {
  applies: string
  dimension: string
  id: number
  name: string
  instruction: string
  validationType: string
  example: string
  calmInstruction: string
  noHumorInstruction: string
}

interface PromptRule {
  date: string
  rule: string
}

interface TimeTheme {
  id: number
  name: string
  time: string
  topic: string
  nightTopic: string
  tone: string
  hint: string
}

interface TimeAction {
  time: string
  id: number
  action: string
  indoorAlternative: string
  scene: string
  intensity: string
}

export type TimeName =
  | '子时'
  | '丑时'
  | '寅时'
  | '卯时'
  | '辰时'
  | '巳时'
  | '午时'
  | '未时'
  | '申时'
  | '酉时'
  | '戌时'
  | '亥时'

const timeNames = new Set<string>([
  '子时',
  '丑时',
  '寅时',
  '卯时',
  '辰时',
  '巳时',
  '午时',
  '未时',
  '申时',
  '酉时',
  '戌时',
  '亥时',
])

function isTimeName(name: string): name is TimeName {
  return timeNames.has(name)
}

const xlsx = createRequire(import.meta.url)('xlsx') as typeof import('xlsx')
const workbookPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../res/每日锦言变量库_v1.xlsx',
)
const workbook = xlsx.readFile(workbookPath)

function readRows(sheetName: string): unknown[][] {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error(`Prompt 工作簿缺少工作表：${sheetName}`)
  return xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim()
}

function asNumber(value: unknown, key: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`Prompt 工作簿参数无效：${key}`)
  return parsed
}

const configRows = readRows('参数配置').slice(1)
const config = new Map(configRows.map((row) => [asText(row[0]), row[1]]))
const variables = readRows('写法变量池')
  .slice(1)
  .map((row) => ({
    applies: asText(row[0]),
    dimension: asText(row[1]),
    id: asNumber(row[2], '写法变量池.编号'),
    name: asText(row[3]),
    instruction: asText(row[4]),
    validationType: asText(row[7]),
    example: asText(row[5]),
    calmInstruction: asText(row[8]),
    noHumorInstruction: asText(row[9]),
  }))
const timeThemes: TimeTheme[] = readRows('时辰主题')
  .slice(1)
  .map((row) => ({
    id: asNumber(row[0], '时辰主题.序号'),
    name: asText(row[1]),
    time: asText(row[2]),
    topic: asText(row[3]),
    nightTopic: asText(row[4]),
    tone: asText(row[5]),
    hint: asText(row[7]),
  }))
const timeActions: TimeAction[] = readRows('时辰动作库')
  .slice(1)
  .map((row) => ({
    time: asText(row[0]),
    id: asNumber(row[1], '时辰动作库.编号'),
    action: asText(row[2]),
    indoorAlternative: asText(row[3]),
    scene: asText(row[4]),
    intensity: asText(row[5]),
  }))
const specialDayRules: PromptRule[] = readRows('特殊日规则')
  .slice(1)
  .map((row) => ({ date: asText(row[0]), rule: asText(row[2]) }))
const prohibitedTerms = readRows('禁用词')
  .slice(1)
  .map((row) => `${asText(row[0])}：${asText(row[1])}`)
  .filter((rule) => !rule.endsWith('：'))

const promptDimensions = [
  { applies: '锦言', dimension: '角度', configKey: '锦言.角度' },
  { applies: '锦言+时辰', dimension: '开头', configKey: '锦言.开头' },
  { applies: '锦言', dimension: '结构', configKey: '锦言.结构' },
  { applies: '锦言', dimension: '结尾', configKey: '锦言.结尾' },
  { applies: '锦言', dimension: '语气', configKey: '锦言.语气' },
  { applies: '锦言', dimension: '称呼', configKey: '锦言.称呼' },
]

function stableHash(value: string): number {
  let hash = 2166136261
  for (const character of value) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0
  }
  return hash
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

function dayNumberFor(date: string): number {
  const epoch = asText(config.get('纪元日期'))
  const epochTime = Date.parse(`${epoch}T00:00:00Z`)
  const dateTime = Date.parse(`${date}T00:00:00Z`)
  if (!Number.isFinite(epochTime) || !Number.isFinite(dateTime)) {
    throw new Error('Prompt 日期或工作簿纪元日期无效')
  }
  return Math.floor((dateTime - epochTime) / 86400000)
}

export function current_time_index(date = new Date()): number {
  return Math.floor(((date.getHours() + 1) % 24) / 2)
}

export function time_name_for_index(timeIndex: number): TimeName {
  const theme = timeThemes.find((item) => item.id === timeIndex)
  if (!theme || !isTimeName(theme.name)) {
    throw new Error(`工作簿未找到有效的时辰序号 ${timeIndex}`)
  }
  return theme.name
}

export function current_time_name(date = new Date()): TimeName {
  return time_name_for_index(current_time_index(date))
}

function isAngleAvailable(variable: WritingVariable, now: Date): boolean {
  const condition = variable.validationType
  if (condition === 'unuse') return false

  if (!condition.startsWith('time_after:') && !condition.startsWith('time_before:')) {
    return true
  }
  const timeCondition = /^(time_after|time_before):(\d{4})$/.exec(condition)
  if (!timeCondition) {
    throw new Error(`角度变量 ${variable.id} 的时间限制格式无效：${condition}`)
  }

  const hours = Number(timeCondition[2].slice(0, 2))
  const minutes = Number(timeCondition[2].slice(2))
  if (hours > 23 || minutes > 59) {
    throw new Error(`角度变量 ${variable.id} 的时间限制无效：${condition}`)
  }

  const limit = hours * 60 + minutes
  const current = now.getHours() * 60 + now.getMinutes()
  return timeCondition[1] === 'time_after' ? current >= limit : current <= limit
}

function openingValidationInstruction(variable: WritingVariable, user: PromptUser): string {
  const name = user.name?.trim() || '用户'
  const validationType = variable.validationType
  if (!validationType) return ''

  if (validationType.startsWith('starts_with_any:')) {
    const prefixes = validationType.slice('starts_with_any:'.length).split('|').filter(Boolean)
    if (!prefixes.length) {
      throw new Error(`开头变量 ${variable.id} 的校验类型没有有效前缀`)
    }
    return `正文必须以以下任一词语开头：${prefixes.map((prefix) => `“${prefix}”`).join('、')}。`
  }

  switch (validationType) {
    case 'starts_with_name':
      return `正文必须以用户称呼“${name}”开头。`
    case 'festival_prefix':
      return '正文前10个字内必须点出当天的节日或相关习俗。'
    case 'weather_prefix':
      return '第一句必须写当天的天气或气温。'
    case 'time_prefix':
      return '正文必须以一个具体时间点或时段开头。'
    case 'starts_with_digit':
      return '正文必须以阿拉伯数字或中文数字开头。'
    case 'first_sentence_question':
      return '第一句必须是问句。'
    default:
      throw new Error(`开头变量 ${variable.id} 使用了不支持的校验类型：${validationType}`)
  }
}

function writingInstruction(variable: WritingVariable, user: PromptUser): string {
  const validation =
    variable.dimension === '开头' ? openingValidationInstruction(variable, user) : ''
  return [variable.instruction, validation].filter(Boolean).join(' ')
}

function selectVariable(
  user: PromptUser,
  applies: string,
  dimension: string,
  configKey: string,
  dayNumber: number,
  specialRules: string[],
  timeIndex?: number,
  now = new Date(),
): WritingVariable {
  let options = variables
    .filter((variable) => variable.applies === applies && variable.dimension === dimension)
    .sort((left, right) => left.id - right.id)
  const configuredCount = asNumber(config.get(`${configKey}.数量`), `${configKey}.数量`)
  if (options.length !== configuredCount) {
    throw new Error(
      `${configKey} 变量数量为 ${options.length}，与工作簿配置 ${configuredCount} 不一致`,
    )
  }
  if (applies === '锦言' && dimension === '角度') {
    options = options.filter((option) => isAngleAvailable(option, now))
    if (!options.length) {
      throw new Error(`${configKey} 当前时间没有可用的角度变量`)
    }
  }

  const multiplierR = asNumber(config.get(`${configKey}.乘数r`), `${configKey}.乘数r`)
  const multiplierD = asNumber(config.get(`${configKey}.乘数d`), `${configKey}.乘数d`)
  let index = multiplierR * dayNumber + multiplierD * stableHash(user.tag)
  if (timeIndex !== undefined) {
    const timeOffset =
      dimension === '开头'
        ? 1 + timeIndex
        : asNumber(config.get(`${configKey}.时辰偏移`), `${configKey}.时辰偏移`) * timeIndex
    index += timeOffset
  }
  index = positiveModulo(index, options.length)
  let selected = options[index]
  if (!selected) throw new Error(`${configKey} 未找到候选位置 ${index} 的写法变量`)

  if (specialRules.some((rule) => rule.includes('锁定沉静')) && dimension === '语气') {
    selected = options.find((option) => option.name === '沉静') ?? selected
  }
  if (specialRules.some((rule) => rule.includes('禁用幽默')) && dimension === '语气') {
    selected = options.find((option) => option.name === '沉静') ?? selected
  }
  if (specialRules.some((rule) => rule.includes('锁定沉静')) && selected.calmInstruction) {
    return { ...selected, instruction: selected.calmInstruction }
  }
  if (specialRules.some((rule) => rule.includes('禁用幽默')) && selected.noHumorInstruction) {
    return { ...selected, instruction: selected.noHumorInstruction }
  }
  return selected
}

function selectTimeAction(user: PromptUser, dayNumber: number, theme: TimeTheme): TimeAction {
  const options = timeActions
    .filter((action) => action.time === theme.name)
    .sort((left, right) => left.id - right.id)
  const configKey = '时辰.动作'
  const count = asNumber(config.get(`${configKey}.数量`), `${configKey}.数量`)
  if (options.length !== count) {
    throw new Error(`${theme.name}动作数量为 ${options.length}，与工作簿配置 ${count} 不一致`)
  }

  const multiplierR = asNumber(config.get(`${configKey}.乘数r`), `${configKey}.乘数r`)
  const multiplierD = asNumber(config.get(`${configKey}.乘数d`), `${configKey}.乘数d`)
  const timeOffset = asNumber(config.get(`${configKey}.时辰偏移`), `${configKey}.时辰偏移`)
  const index = positiveModulo(
    multiplierR * dayNumber + multiplierD * stableHash(user.tag) + timeOffset * theme.id,
    count,
  )
  const selected = options.find((option) => option.id === index)
  if (!selected) throw new Error(`${theme.name}未找到编号 ${index} 的时辰动作`)
  return selected
}

export function build_daily_prompt(user: PromptUser, date: string, now = new Date()): string {
  const dayNumber = dayNumberFor(date)
  const specialRules = specialDayRules.filter((item) => item.date === date).map((item) => item.rule)
  const selected = promptDimensions.map((dimension) =>
    selectVariable(
      user,
      dimension.applies,
      dimension.dimension,
      dimension.configKey,
      dayNumber,
      specialRules,
      undefined,
      now,
    ),
  )
  const wordLimit = `${asNumber(config.get('锦言.字数下限'), '锦言.字数下限')}-${asNumber(config.get('锦言.字数上限'), '锦言.字数上限')}`

  return [
    `请为名为'${user.name?.trim() || '用户'}'的用户写一条 ${date} 的每日锦言。`,
    user.city?.trim()
      ? `所在城市参考：${user.city.trim()}。请结合当地生活环境，不要臆测实时天气，但是可以根据实际天气进行合理推测。`
      : '',
    user.hobbies?.trim() ? `兴趣参考：${user.hobbies.trim()}` : '',
    '请按以下从工作簿读取的写作指令创作，不要输出指令说明，不要使用示例内容：',
    ...selected.map(
      (variable) =>
        `【${variable.dimension}：${variable.name}】${writingInstruction(variable, user)}`,
    ),
    ...selected
      .filter((variable) => variable.example)
      .map((variable) => `【${variable.dimension}示例，仅供风格参考】${variable.example}`),
    specialRules.length ? `当天特殊规则：${specialRules.join('；')}` : '',
    `正文控制在 ${wordLimit} 个汉字。`,
    '只输出一条自然、具体、温和的每日生活锦言；不预测运势，不作医疗或绝对化承诺。',
    prohibitedTerms.length ? `避免使用以下禁用内容：\n${prohibitedTerms.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function build_time_prompt(user: PromptUser, date: string, timeIndex: number): string {
  if (!Number.isInteger(timeIndex) || timeIndex < 0 || timeIndex >= timeThemes.length) {
    throw new Error(`无效的时辰序号：${timeIndex}`)
  }

  const dayNumber = dayNumberFor(date)
  const theme = timeThemes.find((item) => item.id === timeIndex)
  if (!theme) throw new Error(`工作簿未找到时辰序号 ${timeIndex}`)
  const specialRules = specialDayRules.filter((item) => item.date === date).map((item) => item.rule)
  const selected = [
    selectVariable(user, '锦言+时辰', '开头', '锦言.开头', dayNumber, specialRules, timeIndex),
    selectVariable(user, '时辰', '句式', '时辰.句式', dayNumber, specialRules, timeIndex),
    selectVariable(user, '时辰', '细节', '时辰.细节', dayNumber, specialRules, timeIndex),
  ]
  const action = selectTimeAction(user, dayNumber, theme)
  const wordLimit = `${asNumber(config.get('时辰.字数下限'), '时辰.字数下限')}-${asNumber(config.get('时辰.字数上限'), '时辰.字数上限')}`

  return [
    `请为名为'${user.name?.trim() || '用户'}'的用户写一条 ${date} ${theme.name}（${theme.time}）时辰锦言。`,
    user.city?.trim()
      ? `所在城市参考：${user.city.trim()}。请结合当地生活环境，不要臆测实时天气。`
      : '',
    user.hobbies?.trim() ? `兴趣参考：${user.hobbies.trim()}` : '',
    `本时辰主题：${theme.topic}；写作提示：${theme.hint}`,
    `默认语气：${theme.tone}。`,
    `请以这条时辰动作作为祈使建议的参考：${action.action}`,
    action.indoorAlternative ? `雨天或室内替代：${action.indoorAlternative}` : '',
    `动作场景：${action.scene}；强度：${action.intensity}。`,
    '「锦言+时辰」写法变量适用于每日锦言与时辰锦言；请按以下工作簿指令创作，不要输出指令说明，不要使用示例内容：',
    ...selected.map(
      (variable) =>
        `【${variable.dimension}：${variable.name}】${writingInstruction(variable, user)}`,
    ),
    ...selected
      .filter((variable) => variable.example)
      .map((variable) => `【${variable.dimension}示例，仅供风格参考】${variable.example}`),
    specialRules.length ? `当天特殊规则：${specialRules.join('；')}` : '',
    `正文控制在 ${wordLimit} 个汉字。`,
    '只输出一条自然、具体、温和的时辰生活锦言；不要预测运势，不作医疗或绝对化承诺。',
    prohibitedTerms.length ? `避免使用以下禁用内容：\n${prohibitedTerms.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}
