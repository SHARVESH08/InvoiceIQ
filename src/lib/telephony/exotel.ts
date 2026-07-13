import 'server-only'

// ─────────────────────────────────────────────────────────────────────────────
// Exotel Voice v1 client (Connect Two Numbers + Call Details fallback).
// Docs: https://developer.exotel.com/api/make-a-call-api
//       https://developer.exotel.com/docs/voice-v1/api-reference/status-callback
// Flow: Exotel dials `from` (the agent) first; on pickup it bridges `to` (the
// customer). CallerId must be the company's Exophone (virtual number).
// ─────────────────────────────────────────────────────────────────────────────

export interface ExotelCredentials {
  accountSid: string
  apiKey: string
  apiToken: string
}

export interface ConnectCallParams {
  credentials: ExotelCredentials
  /** Agent's phone — dialed first. */
  from: string
  /** Customer's phone — bridged after the agent answers. */
  to: string
  /** The company's Exophone (virtual number) shown to both parties. */
  callerId: string
  record: boolean
  /** Absolute URL Exotel POSTs terminal status + RecordingUrl to. */
  statusCallbackUrl: string
}

export interface ExotelCallResponse {
  sid: string
  status: string
}

const BASE = 'https://api.exotel.com/v1/Accounts'

function authHeader(c: ExotelCredentials): string {
  return 'Basic ' + Buffer.from(`${c.apiKey}:${c.apiToken}`).toString('base64')
}

/** Normalizes Indian numbers to digits with optional leading +91 kept intact. */
export function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-()]/g, '')
  if (/^\+\d{10,14}$/.test(cleaned)) return cleaned
  if (/^0\d{10}$/.test(cleaned)) return cleaned.slice(1)
  return cleaned
}

/** Builds the form body for the connect call (exported for tests). */
export function buildConnectBody(p: Omit<ConnectCallParams, 'credentials'>): URLSearchParams {
  const body = new URLSearchParams({
    From: normalizePhone(p.from),
    To: normalizePhone(p.to),
    CallerId: p.callerId,
    Record: p.record ? 'true' : 'false',
    StatusCallback: p.statusCallbackUrl,
    StatusCallbackContentType: 'application/json',
  })
  // Terminal event carries Status/Duration/RecordingUrl; answered lets the UI
  // flip from "ringing" to "connected".
  body.append('StatusCallbackEvents[0]', 'terminal')
  body.append('StatusCallbackEvents[1]', 'answered')
  return body
}

export async function connectCall(params: ConnectCallParams): Promise<ExotelCallResponse> {
  const url = `${BASE}/${params.credentials.accountSid}/Calls/connect.json`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader(params.credentials),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: buildConnectBody(params).toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Exotel connect failed (${res.status}): ${text.slice(0, 300)}`)
  }

  const json = (await res.json()) as { Call?: { Sid?: string; Status?: string } }
  const sid = json.Call?.Sid
  if (!sid) throw new Error('Exotel connect returned no call Sid')
  return { sid, status: json.Call?.Status ?? 'initiated' }
}

/**
 * Call Details fallback — Exotel documents that StatusCallback delivery can
 * occasionally fail; this lets us reconcile stuck 'initiated' calls.
 */
export async function getCallDetails(
  credentials: ExotelCredentials,
  callSid: string
): Promise<{ status: string; duration: number | null; recordingUrl: string | null }> {
  const url = `${BASE}/${credentials.accountSid}/Calls/${callSid}.json`
  const res = await fetch(url, { headers: { Authorization: authHeader(credentials) } })
  if (!res.ok) throw new Error(`Exotel call details failed (${res.status})`)
  const json = (await res.json()) as {
    Call?: { Status?: string; Duration?: string; RecordingUrl?: string }
  }
  return {
    status: json.Call?.Status ?? 'unknown',
    duration: json.Call?.Duration ? Number(json.Call.Duration) : null,
    recordingUrl: json.Call?.RecordingUrl ?? null,
  }
}

/**
 * Streams a recording with the company's credentials (recording URLs require
 * basic auth) — used by the proxy route so credentials never reach the client.
 */
export async function fetchRecording(
  credentials: ExotelCredentials,
  recordingUrl: string
): Promise<Response> {
  return fetch(recordingUrl, { headers: { Authorization: authHeader(credentials) } })
}
