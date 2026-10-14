import { BamblooError, BamblooStatusCode } from '../../../common/status'
import type { UserProfile } from '../core/entity/user'
import { build_daily_prompt } from './daily-prompt-template'

interface AiAstrologerOptions {
  apiKey?: string
  endpoint?: string
  model?: string
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
  error?: {
    code?: string
    message?: string
  }
}

const ASTROLOGER_SYSTEM_PROMPT =
  '你是一名中文生活方式内容作者。请严格遵循用户消息中由工作簿读取的写作指令，创作具体、温和的每日锦言；不得预测运势、作医疗承诺或使用用户提供的禁用词。'

export class AiAstrologer {
  private readonly apiKey: string
  private readonly endpoint: string
  private readonly model: string

  public static instance: AiAstrologer = new AiAstrologer()
  private constructor(options: AiAstrologerOptions = {}) {
    this.apiKey =
      options.apiKey ?? process.env.BIG_MODEL_API_KEY ?? process.env.BIGMODEL_API_KEY ?? ''
    this.endpoint = options.endpoint ?? 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
    this.model = options.model ?? 'GLM-4.7-Flash'
  }

  ask(question: string): Promise<string> {
    const prompt = question.trim()
    if (!prompt) {
      return Promise.reject(new Error('占星问题不能为空'))
    }
    if (!this.apiKey) {
      return Promise.reject(new Error('未配置 BIG_MODEL_API_KEY'))
    }

    return fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: ASTROLOGER_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        thinking: { type: 'disabled' },
        reasoning_effort: 'max',
        max_tokens: 2 * 1024,
        temperature: 1,
      }),
      signal: AbortSignal.timeout(180000),
    }).then((response) =>
      response.json().then((payload: unknown) => {
        const result = payload as ChatCompletionResponse
        if (!response.ok) {
          throw new BamblooError(
            BamblooStatusCode.Retry,
            `AI 服务请求失败：ZP ${result.error!.code} ${result.error!.message}`,
          )
        }

        const answer = result.choices?.[0]?.message?.content?.trim()
        if (!answer) {
          throw new Error('AI 服务未返回有效内容')
        }
        return answer
      }),
    )
  }

  daily_fortune(user: UserProfile, day: string): Promise<{ prompt: string; fortune: string }> {
    const prompt = build_daily_prompt(user, day)
    return this.ask(prompt).then((fortune) => ({ prompt, fortune }))
  }
}
