import 'server-only'

import Groq from 'groq-sdk'

export interface DaySnapshot {
  date: string           // 'YYYY-MM-DD'
  revenue: number        // rupees
  invoice_count: number
  top_product: string
  pending_count: number
  pending_value: number  // rupees
}

export function createGroqClient(): Groq {
  return new Groq({ apiKey: process.env.GROQ_API_KEY! })
}

export async function askGroq(
  userMessage: string,
  companyContext: string,
  maxTokens = 300
): Promise<string> {
  const client = createGroqClient()
  const completion = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: companyContext },
      { role: 'user', content: userMessage },
    ],
    max_tokens: maxTokens,
    temperature: 0.3,
    stream: false,
  })
  return completion.choices[0]?.message?.content?.trim() ?? ''
}
