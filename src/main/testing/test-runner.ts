import { AIProvider } from '../ai/provider'
import { OutputLinter } from '../services/output-linter'
import testCasesData from './test-cases.json'

export interface TestCase {
  id: string
  category: string
  description: string
  input: string
  expectedBehavior: {
    shouldContainAnswer?: boolean
    shouldNotBeCustomerService?: boolean
    shouldNotAskTooManyQuestions?: boolean
    shouldProvideContext?: boolean
    shouldCorrectError?: boolean
    shouldExplainWhy?: boolean
    shouldNotOverCorrect?: boolean
    shouldIdentifyMainStructure?: boolean
    shouldBreakDownClauses?: boolean
    shouldNotOverSimplify?: boolean
    shouldRespondNaturally?: boolean
    shouldNotOverEncourage?: boolean
    shouldGiveDirectAnswer?: boolean
    shouldAddTransferHint?: boolean
    shouldNotAskMoreQuestions?: boolean
    shouldSummarizeKeyPoints?: boolean
    shouldNotBeTooLong?: boolean
    shouldNotOverPraise?: boolean
    shouldClarifyPreviousPoint?: boolean
    shouldSimplifyExplanation?: boolean
    shouldNotRepeatSameExplanation?: boolean
  }
  evaluationCriteria: Record<string, unknown>
}

export interface TestResult {
  testCaseId: string
  passed: boolean
  response: string
  issues: string[]
  score: number
  duration: number
}

export interface TestReport {
  totalTests: number
  passedTests: number
  failedTests: number
  averageScore: number
  results: TestResult[]
  summary: {
    byCategory: Record<string, { passed: number; failed: number }>
    styleIssues: number
  }
}

export class TestRunner {
  private outputLinter: OutputLinter
  private testCases: TestCase[]

  constructor(private aiProvider: AIProvider) {
    this.outputLinter = new OutputLinter()
    this.testCases = testCasesData.testCases as TestCase[]
  }

  async runAll(): Promise<TestReport> {
    const results: TestResult[] = []

    for (const testCase of this.testCases) {
      const result = await this.runTestCase(testCase)
      results.push(result)
    }

    return this.generateReport(results)
  }

  async runByCategory(category: string): Promise<TestReport> {
    const filteredCases = this.testCases.filter(tc => tc.category === category)
    const results: TestResult[] = []

    for (const testCase of filteredCases) {
      const result = await this.runTestCase(testCase)
      results.push(result)
    }

    return this.generateReport(results)
  }

  async runById(testId: string): Promise<TestResult | null> {
    const testCase = this.testCases.find(tc => tc.id === testId)
    if (!testCase) return null

    return this.runTestCase(testCase)
  }

  private async runTestCase(testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now()
    const issues: string[] = []
    let score = 0

    try {
      // Call AI provider
      const response = await this.aiProvider.chat({
        messages: [
          { role: 'system', content: '你是考研英语 AI 陪练。' },
          { role: 'user', content: testCase.input }
        ]
      })

      const responseTime = Date.now() - startTime
      const responseContent = response.content

      // Run linter
      const lintResult = this.outputLinter.lint(responseContent)

      // Check style compliance
      if (testCase.expectedBehavior.shouldNotBeCustomerService) {
        const hasCustomerService = lintResult.issues.some(i => i.type === 'customer_service_opening')
        if (hasCustomerService) {
          issues.push('包含客服式开场')
        } else {
          score += 0.2
        }
      }

      if (testCase.expectedBehavior.shouldNotOverEncourage) {
        const hasExcessiveEncouragement = lintResult.issues.some(i => i.type === 'excessive_encouragement')
        if (hasExcessiveEncouragement) {
          issues.push('包含过度鼓励')
        } else {
          score += 0.2
        }
      }

      if (testCase.expectedBehavior.shouldNotAskTooManyQuestions) {
        const hasConsecutiveQuestions = lintResult.issues.some(i => i.type === 'consecutive_questions')
        if (hasConsecutiveQuestions) {
          issues.push('连续反问过多')
        } else {
          score += 0.1
        }
      }

      // Check content completeness
      if (testCase.expectedBehavior.shouldContainAnswer) {
        const hasAnswer = responseContent.length > 50
        if (hasAnswer) {
          score += 0.3
        } else {
          issues.push('回答过于简短')
        }
      }

      if (testCase.expectedBehavior.shouldProvideContext) {
        const hasContext = /考研|考试|阅读|写作/.test(responseContent)
        if (hasContext) {
          score += 0.2
        } else {
          issues.push('缺少考试语境')
        }
      }

      // Normalize score to 0-1
      score = Math.min(1, score)

      return {
        testCaseId: testCase.id,
        passed: issues.length === 0 && score >= 0.6,
        response: responseContent,
        issues,
        score,
        duration: responseTime
      }
    } catch (err) {
      return {
        testCaseId: testCase.id,
        passed: false,
        response: '',
        issues: [`执行错误: ${err instanceof Error ? err.message : String(err)}`],
        score: 0,
        duration: Date.now() - startTime
      }
    }
  }

  private generateReport(results: TestResult[]): TestReport {
    const passedTests = results.filter(r => r.passed).length
    const failedTests = results.length - passedTests
    const averageScore = results.reduce((sum, r) => sum + r.score, 0) / results.length

    // Group by category
    const byCategory: Record<string, { passed: number; failed: number }> = {}
    for (const result of results) {
      const testCase = this.testCases.find(tc => tc.id === result.testCaseId)
      if (testCase) {
        if (!byCategory[testCase.category]) {
          byCategory[testCase.category] = { passed: 0, failed: 0 }
        }
        if (result.passed) {
          byCategory[testCase.category].passed++
        } else {
          byCategory[testCase.category].failed++
        }
      }
    }

    // Count style issues
    const styleIssues = results.reduce((count, r) => {
      return count + r.issues.filter(i =>
        i.includes('客服') || i.includes('鼓励') || i.includes('反问')
      ).length
    }, 0)

    return {
      totalTests: results.length,
      passedTests,
      failedTests,
      averageScore,
      results,
      summary: {
        byCategory,
        styleIssues
      }
    }
  }

  getTestCases(): TestCase[] {
    return [...this.testCases]
  }

  getTestCaseById(id: string): TestCase | undefined {
    return this.testCases.find(tc => tc.id === id)
  }

  /**
   * Format report as human-readable string
   */
  formatReport(report: TestReport): string {
    const lines: string[] = []

    lines.push('=== AI 英语老师测试报告 ===')
    lines.push('')
    lines.push(`总测试数: ${report.totalTests}`)
    lines.push(`通过: ${report.passedTests}`)
    lines.push(`失败: ${report.failedTests}`)
    lines.push(`平均分: ${(report.averageScore * 100).toFixed(1)}%`)
    lines.push(`风格问题: ${report.summary.styleIssues}`)
    lines.push('')

    lines.push('--- 按类别统计 ---')
    for (const [category, stats] of Object.entries(report.summary.byCategory)) {
      lines.push(`${category}: ${stats.passed} 通过, ${stats.failed} 失败`)
    }
    lines.push('')

    lines.push('--- 详细结果 ---')
    for (const result of report.results) {
      const status = result.passed ? '✓' : '✗'
      lines.push(`${status} ${result.testCaseId} (${(result.score * 100).toFixed(0)}%, ${result.duration}ms)`)
      if (result.issues.length > 0) {
        for (const issue of result.issues) {
          lines.push(`  - ${issue}`)
        }
      }
    }

    return lines.join('\n')
  }
}
