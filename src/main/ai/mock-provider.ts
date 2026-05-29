import { AIProvider, AIRequest, AIResponse } from './provider'

const RESPONSES = [
  "这是个好问题。让我帮你理解一下。",
  "我明白你的意思了。关键点在于：",
  "让我用一种容易理解的方式来解释。",
  "进步很大！让我们继续下一个概念。",
  "这是考研中一个重要的语法点。"
]

export class MockAIProvider implements AIProvider {
  name = 'mock'

  abort(): void {
    // Mock provider doesn't need to abort anything
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    const lastMessage = request.messages[request.messages.length - 1]
    const content = lastMessage?.content || ''

    let response: string

    if (content.toLowerCase().includes('hello') || content.toLowerCase().includes('hi')) {
      response = "你好！我是你的 AI 英语学习助手。今天有什么可以帮你的吗？"
    } else if (content.includes('单词') || content.includes('word')) {
      response = "让我们练习一些词汇。你能告诉我这个词在上下文中的意思吗？"
    } else if (content.includes('语法') || content.includes('grammar')) {
      response = "语法对考研很重要。让我清楚地解释这个规则。"
    } else {
      const idx = Math.floor(Math.random() * RESPONSES.length)
      response = RESPONSES[idx] + "\n\n" + `你说的是："${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`
    }

    return {
      content: response,
      usage: {
        inputTokens: content.length,
        outputTokens: response.length
      }
    }
  }
}
