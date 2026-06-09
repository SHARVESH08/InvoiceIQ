import { describe, it, expect, vi, beforeEach } from 'vitest'
import { uploadPdfToStorage } from '@/lib/pdf/storage'

function makeMockSupabase({
  uploadResult = { error: null },
  signedUrlResult = { data: { signedUrl: 'https://signed.example.com/invoices/test-id-123.pdf' }, error: null },
}: {
  uploadResult?: { error: null | { message: string } }
  signedUrlResult?: { data: { signedUrl: string } | null; error: null | { message: string } }
} = {}) {
  const upload = vi.fn().mockResolvedValue(uploadResult)
  const createSignedUrl = vi.fn().mockResolvedValue(signedUrlResult)
  const from = vi.fn().mockReturnValue({ upload, createSignedUrl })
  return {
    storage: { from },
    _mocks: { from, upload, createSignedUrl },
  }
}

describe('pdf-storage', () => {
  const INVOICE_ID = 'test-id-123'
  const EXPECTED_PATH = `invoices/${INVOICE_ID}.pdf`
  const EXPECTED_TTL = 60 * 60 * 24 * 365 // 31536000
  const fakeBuffer = Buffer.from('%PDF-1.4 fake pdf content')

  it('PDF-02: uploadPdfToStorage calls supabase.storage.from(\'invoices\').upload with contentType application/pdf', async () => {
    const supabase = makeMockSupabase()
    await uploadPdfToStorage(supabase as any, fakeBuffer, INVOICE_ID)

    expect(supabase._mocks.from).toHaveBeenCalledWith('invoices')
    expect(supabase._mocks.upload).toHaveBeenCalledWith(
      EXPECTED_PATH,
      fakeBuffer,
      expect.objectContaining({ contentType: 'application/pdf', upsert: true }),
    )
  })

  it('PDF-02: uploadPdfToStorage path equals invoices/{invoiceId}.pdf', async () => {
    const supabase = makeMockSupabase()
    await uploadPdfToStorage(supabase as any, fakeBuffer, INVOICE_ID)

    const [uploadPath] = supabase._mocks.upload.mock.calls[0]
    expect(uploadPath).toBe(EXPECTED_PATH)

    const [signedPath, ttl] = supabase._mocks.createSignedUrl.mock.calls[0]
    expect(signedPath).toBe(EXPECTED_PATH)
    expect(ttl).toBe(EXPECTED_TTL)
  })

  it('PDF-02: uploadPdfToStorage returns a signed URL string', async () => {
    const supabase = makeMockSupabase()
    const result = await uploadPdfToStorage(supabase as any, fakeBuffer, INVOICE_ID)

    expect(typeof result).toBe('string')
    expect(result).toBe('https://signed.example.com/invoices/test-id-123.pdf')
  })

  it('PDF-02: storage bucket \'invoices\' is private (no createSignedUrl fallback to public URL)', async () => {
    const supabase = makeMockSupabase({
      uploadResult: { error: { message: 'denied' } },
    })

    await expect(uploadPdfToStorage(supabase as any, fakeBuffer, INVOICE_ID)).rejects.toThrow('denied')
    // createSignedUrl must NOT be called on upload failure
    expect(supabase._mocks.createSignedUrl).not.toHaveBeenCalled()
  })
})
