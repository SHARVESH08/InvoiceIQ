/**
 * Telephony tests (Exotel click-to-call + recording)
 * Covers: connect-body construction, phone normalization, callback parsing,
 * initiateCall guard rails (no settings / no agent phone), settings validation.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockRpc, mockFrom, mockGetUser, mockAdminFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
  mockAdminFrom: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
    from: mockFrom,
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({ from: mockAdminFrom }),
}))

import { buildConnectBody, normalizePhone } from '@/lib/telephony/exotel'
import { parseCallbackBody } from '@/lib/telephony/callback'
import { initiateCall, saveTelephonySettings } from '@/lib/actions/telephony'

function authOk() {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  mockRpc.mockImplementation((fn: string) =>
    fn === 'get_company_id'
      ? Promise.resolve({ data: 'company-1', error: null })
      : Promise.resolve({ data: null, error: null })
  )
}

/** admin.from() stub returning settings/agent rows per table. */
function mockAdminTables(rows: { settings?: object | null; agent?: object | null }) {
  mockAdminFrom.mockImplementation((table: string) => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: rows.settings ?? null, error: null }),
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi
            .fn()
            .mockResolvedValue({ data: rows.agent ?? null, error: null }),
        }),
      }),
    }),
    _table: table,
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── exotel client ────────────────────────────────────────────────────────────

describe('normalizePhone', () => {
  it('strips separators and leading zero', () => {
    expect(normalizePhone('098 123-45678')).toBe('9812345678')
    expect(normalizePhone('+91 98123 45678')).toBe('+919812345678')
    expect(normalizePhone('9812345678')).toBe('9812345678')
  })
})

describe('buildConnectBody', () => {
  it('builds the documented Connect Two Numbers form fields', () => {
    const body = buildConnectBody({
      from: '+91 9812345678',
      to: '098765 43210',
      callerId: '08047112233',
      record: true,
      statusCallbackUrl: 'https://app.example.com/api/telephony/exotel/callback?token=t',
    })
    expect(body.get('From')).toBe('+919812345678')
    expect(body.get('To')).toBe('9876543210')
    expect(body.get('CallerId')).toBe('08047112233')
    expect(body.get('Record')).toBe('true')
    expect(body.get('StatusCallbackContentType')).toBe('application/json')
    expect(body.getAll('StatusCallbackEvents[0]')).toEqual(['terminal'])
    expect(body.getAll('StatusCallbackEvents[1]')).toEqual(['answered'])
  })
})

// ─── callback parsing ─────────────────────────────────────────────────────────

describe('parseCallbackBody', () => {
  it('parses JSON payloads', async () => {
    const req = new Request('http://x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        CallSid: 'sid-1',
        Status: 'completed',
        RecordingUrl: 'https://recordings.exotel.com/x.mp3',
        ConversationDuration: 93,
      }),
    })
    const payload = await parseCallbackBody(req)
    expect(payload.CallSid).toBe('sid-1')
    expect(payload.Status).toBe('completed')
    expect(payload.RecordingUrl).toContain('.mp3')
    expect(payload.ConversationDuration).toBe(93)
  })

  it('parses form-encoded payloads', async () => {
    const form = new URLSearchParams({ CallSid: 'sid-2', Status: 'no-answer' })
    const req = new Request('http://x', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    const payload = await parseCallbackBody(req)
    expect(payload.CallSid).toBe('sid-2')
    expect(payload.Status).toBe('no-answer')
  })
})

// ─── initiateCall guards ─────────────────────────────────────────────────────

describe('initiateCall', () => {
  it('requires a linked record', async () => {
    const result = await initiateCall({ to_number: '9876543210' })
    expect(result).toEqual({ error: 'Call must be linked to a customer, lead, or deal' })
  })

  it('errors clearly when telephony is not configured', async () => {
    authOk()
    mockAdminTables({ settings: null, agent: { phone: '9812345678' } })
    const result = await initiateCall({ to_number: '9876543210', lead_id: '2b0f8f6e-1111-4222-8333-444455556666' })
    expect('error' in result && result.error).toMatch(/not set up/i)
  })

  it('errors clearly when the agent has no phone saved', async () => {
    authOk()
    mockAdminTables({
      settings: {
        account_sid: 'sid',
        api_key: 'k',
        api_token: 't',
        virtual_number: '08047112233',
        webhook_token: 'wh',
        record_calls: true,
      },
      agent: null,
    })
    const result = await initiateCall({ to_number: '9876543210', lead_id: '2b0f8f6e-1111-4222-8333-444455556666' })
    expect('error' in result && result.error).toMatch(/your phone number/i)
  })
})

// ─── settings validation ──────────────────────────────────────────────────────

describe('saveTelephonySettings', () => {
  it('rejects incomplete credentials before touching the database', async () => {
    const result = await saveTelephonySettings({
      account_sid: '',
      api_key: 'k',
      api_token: 't',
      virtual_number: '08047112233',
      record_calls: true,
    })
    expect(result).toEqual({ error: 'Account SID is required' })
    expect(mockFrom).not.toHaveBeenCalled()
  })
})
