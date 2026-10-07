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
    message?: string
  }
}

const ASTROLOGER_SYSTEM_PROMPT =
  '你是一名温和、理性的 AI 占星师。请将占星内容作为自我探索和娱乐参考，不要将其描述为确定的事实或替代专业建议。'

export class AiAstrologer {
  private readonly apiKey: string
  private readonly endpoint: string
  private readonly model: string

  constructor(options: AiAstrologerOptions = {}) {
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
          throw new Error(result.error?.message || `AI 服务请求失败：HTTP ${response.status}`)
        }

        const answer = result.choices?.[0]?.message?.content?.trim()
        if (!answer) {
          throw new Error('AI 服务未返回有效内容')
        }
        return answer
      }),
    )
  }
}
