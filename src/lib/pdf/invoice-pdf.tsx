import 'server-only'

import { renderToBuffer, Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { rupeesToWords } from './number-to-words'

export type InvoiceForPdf = {
  id: string
  invoice_number: string
  invoice_date: string
  due_date: string | null
  doc_type: 'sale' | 'purchase' | 'credit_note' | 'debit_note'
  subtotal: number
  discount_amount: number
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_amount: number
  customer_name: string
  customer_gstin: string | null
  customer_address: string | null
  customer_state_code: string | null
  company: {
    name: string
    gstin: string | null
    address: string | null
  }
  invoice_items: Array<{
    description: string
    hsn_code: string | null
    quantity: number
    unit_price: number
    discount_percent: number
    tax_rate: number
    taxable_amount: number
    cgst_amount: number
    sgst_amount: number
    igst_amount: number
    total_amount: number
  }>
}

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#111827',
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  logo: {
    width: 48,
    height: 48,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  companyDetail: {
    fontSize: 8,
    color: '#6b7280',
    marginBottom: 1,
  },
  titleStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f3f4f6',
    padding: 6,
    marginBottom: 10,
  },
  titleLabel: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
  titleNumber: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 7,
    color: '#6b7280',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 9,
  },
  billTo: {
    marginBottom: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  billToTitle: {
    fontSize: 7,
    color: '#6b7280',
    marginBottom: 4,
  },
  billToName: {
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  billToDetail: {
    fontSize: 8,
    color: '#374151',
    marginBottom: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e3a5f',
    padding: 4,
  },
  tableHeaderText: {
    color: '#ffffff',
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    padding: 4,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    padding: 4,
    backgroundColor: '#f9fafb',
  },
  colNo: { width: '4%', fontSize: 7 },
  colDesc: { width: '28%', fontSize: 7 },
  colHsn: { width: '10%', fontSize: 7 },
  colQty: { width: '8%', fontSize: 7, textAlign: 'right' },
  colRate: { width: '12%', fontSize: 7, textAlign: 'right' },
  colDisc: { width: '8%', fontSize: 7, textAlign: 'right' },
  colTax: { width: '8%', fontSize: 7, textAlign: 'right' },
  colAmt: { width: '22%', fontSize: 7, textAlign: 'right' },
  totalsSection: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    width: 200,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  totalLabel: {
    fontSize: 8,
    color: '#374151',
  },
  totalValue: {
    fontSize: 8,
    color: '#111827',
  },
  totalRowBold: {
    flexDirection: 'row',
    width: 200,
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderTopWidth: 1,
    borderTopColor: '#111827',
    marginTop: 2,
  },
  totalLabelBold: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  totalValueBold: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  totalInWords: {
    marginTop: 8,
    fontSize: 8,
    fontFamily: 'Helvetica-Oblique',
    color: '#374151',
  },
  qrPlaceholder: {
    position: 'absolute',
    bottom: 32,
    right: 32,
    width: 64,
    height: 64,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrLabel: {
    fontSize: 8,
    color: '#9ca3af',
  },
})

function formatDate(iso: string): string {
  const d = new Date(iso)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`
}

function docTypeLabel(type: string): string {
  switch (type) {
    case 'sale': return 'Sale Invoice'
    case 'purchase': return 'Purchase Invoice'
    case 'credit_note': return 'Credit Note'
    case 'debit_note': return 'Debit Note'
    default: return type
  }
}

function fmt(n: number): string {
  return n.toFixed(2)
}

export async function generateInvoicePdf(input: InvoiceForPdf): Promise<Buffer> {
  const isIntraState = input.cgst_amount > 0
  const totalPaise = Math.round(Number(input.total_amount) * 100)
  const totalInWords = rupeesToWords(totalPaise)

  const doc = (
    <Document>
      <Page size="A4" orientation="portrait" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>{input.company.name.slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>{input.company.name}</Text>
            {input.company.gstin ? (
              <Text style={styles.companyDetail}>GSTIN: {input.company.gstin}</Text>
            ) : null}
            {input.company.address ? (
              <Text style={styles.companyDetail}>{input.company.address}</Text>
            ) : null}
          </View>
        </View>

        {/* Title strip */}
        <View style={styles.titleStrip}>
          <Text style={styles.titleLabel}>TAX INVOICE</Text>
          <Text style={styles.titleNumber}>{input.invoice_number}</Text>
        </View>

        {/* Meta row */}
        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Invoice Date</Text>
            <Text style={styles.metaValue}>{formatDate(input.invoice_date)}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Due Date</Text>
            <Text style={styles.metaValue}>{input.due_date ? formatDate(input.due_date) : '-'}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Document Type</Text>
            <Text style={styles.metaValue}>{docTypeLabel(input.doc_type)}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Tax Type</Text>
            <Text style={styles.metaValue}>{isIntraState ? 'CGST + SGST' : 'IGST'}</Text>
          </View>
        </View>

        {/* Bill To */}
        <View style={styles.billTo}>
          <Text style={styles.billToTitle}>BILL TO</Text>
          <Text style={styles.billToName}>{input.customer_name}</Text>
          {input.customer_gstin ? (
            <Text style={styles.billToDetail}>GSTIN: {input.customer_gstin}</Text>
          ) : null}
          {input.customer_address ? (
            <Text style={styles.billToDetail}>{input.customer_address}</Text>
          ) : null}
          {input.customer_state_code ? (
            <Text style={styles.billToDetail}>State Code: {input.customer_state_code}</Text>
          ) : null}
        </View>

        {/* Items table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colNo]}>#</Text>
          <Text style={[styles.tableHeaderText, styles.colDesc]}>Description</Text>
          <Text style={[styles.tableHeaderText, styles.colHsn]}>HSN</Text>
          <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
          <Text style={[styles.tableHeaderText, styles.colRate]}>Rate</Text>
          <Text style={[styles.tableHeaderText, styles.colDisc]}>Disc%</Text>
          <Text style={[styles.tableHeaderText, styles.colTax]}>Tax%</Text>
          <Text style={[styles.tableHeaderText, styles.colAmt]}>Amount</Text>
        </View>
        {input.invoice_items.map((item, i) => (
          <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
            <Text style={styles.colNo}>{i + 1}</Text>
            <Text style={styles.colDesc}>{item.description}</Text>
            <Text style={styles.colHsn}>{item.hsn_code ?? ''}</Text>
            <Text style={styles.colQty}>{item.quantity}</Text>
            <Text style={styles.colRate}>{fmt(item.unit_price)}</Text>
            <Text style={styles.colDisc}>{item.discount_percent}</Text>
            <Text style={styles.colTax}>{item.tax_rate}</Text>
            <Text style={styles.colAmt}>{fmt(item.total_amount)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{fmt(input.subtotal)}</Text>
          </View>
          {input.discount_amount > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount</Text>
              <Text style={styles.totalValue}>-{fmt(input.discount_amount)}</Text>
            </View>
          ) : null}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Taxable Amount</Text>
            <Text style={styles.totalValue}>{fmt(input.taxable_amount)}</Text>
          </View>
          {isIntraState ? (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>CGST</Text>
                <Text style={styles.totalValue}>{fmt(input.cgst_amount)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>SGST</Text>
                <Text style={styles.totalValue}>{fmt(input.sgst_amount)}</Text>
              </View>
            </>
          ) : (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>IGST</Text>
              <Text style={styles.totalValue}>{fmt(input.igst_amount)}</Text>
            </View>
          )}
          <View style={styles.totalRowBold}>
            <Text style={styles.totalLabelBold}>Total Amount</Text>
            <Text style={styles.totalValueBold}>{fmt(input.total_amount)}</Text>
          </View>
        </View>

        {/* Total in words */}
        <Text style={styles.totalInWords}>{totalInWords}</Text>

        {/* QR placeholder */}
        <View style={styles.qrPlaceholder}>
          <Text style={styles.qrLabel}>QR</Text>
        </View>
      </Page>
    </Document>
  )

  const uint8Array = await renderToBuffer(doc)
  return Buffer.from(uint8Array)
}
