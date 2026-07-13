// Exotel StatusCallback payload shape + body parsing, kept out of the route
// file (Next route modules may only export HTTP methods) and unit-testable.

export interface ExotelCallbackPayload {
  CallSid?: string
  EventType?: string
  Status?: string
  RecordingUrl?: string
  ConversationDuration?: number | string
  StartTime?: string
  EndTime?: string
}

/** Parses either JSON or form-encoded callback bodies. */
export async function parseCallbackBody(req: Request): Promise<ExotelCallbackPayload> {
  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return (await req.json()) as ExotelCallbackPayload
  }
  const form = await req.formData()
  const obj: Record<string, string> = {}
  form.forEach((value, key) => {
    obj[key] = String(value)
  })
  return obj as ExotelCallbackPayload
}
