'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronLeft, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { SupplierSchema, type SupplierInput } from '@/lib/schemas/supplier'
import { updateSupplier } from '@/lib/actions/suppliers'
import { validateGstin, GSTIN_STATE_CODES } from '@/lib/gstin'

interface Supplier {
  id: string
  name: string
  gstin: string | null
  phone: string | null
  email: string | null
  state_code: string | null
  address: { street?: string; city?: string; pincode?: string } | null
  company_id: string
  created_at: string
  updated_at: string
}

interface SupplierEditFormProps {
  supplier: Supplier
}

export function SupplierEditForm({ supplier }: SupplierEditFormProps) {
  const [gstinStateName, setGstinStateName] = useState<string | null>(() => {
    if (supplier.gstin && supplier.state_code) {
      return GSTIN_STATE_CODES[supplier.state_code] ?? null
    }
    return null
  })

  const form = useForm<SupplierInput>({
    resolver: zodResolver(SupplierSchema) as Resolver<SupplierInput>,
    defaultValues: {
      name: supplier.name,
      gstin: supplier.gstin ?? '',
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      state_code: supplier.state_code ?? '',
      // Map address jsonb back to flat form fields
      street: supplier.address?.street ?? '',
      city: supplier.address?.city ?? '',
      pincode: supplier.address?.pincode ?? '',
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  })

  async function onSubmit(values: SupplierInput) {
    const result = await updateSupplier(supplier.id, values)
    if (result?.error) {
      form.setError('root', { message: result.error })
    }
    // On success: updateSupplier redirects server-side — client code below never runs
  }

  return (
    <main className="flex-1 p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <Link href="/suppliers">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Suppliers
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Edit Supplier</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              {/* Supplier Information */}
              <div className="space-y-4">
                <h2 className="text-base font-bold">Supplier Information</h2>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Sharma Traders" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gstin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GSTIN</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="27AAPFU0939F1ZV"
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const upper = e.target.value.toUpperCase()
                            field.onChange(upper)
                            const result = validateGstin(upper)
                            if (result.valid && result.state_code) {
                              form.setValue('state_code', result.state_code)
                              setGstinStateName(
                                GSTIN_STATE_CODES[result.state_code] ?? null
                              )
                            } else {
                              setGstinStateName(null)
                            }
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        15-character GST Identification Number (optional)
                        {gstinStateName && (
                          <span className="ml-2 text-foreground font-medium">
                            State: {gstinStateName} — auto-populates State Code field
                          </span>
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="state_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State Code</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          placeholder="e.g. 27"
                          readOnly={!!gstinStateName}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Contact */}
              <div className="space-y-4">
                <h2 className="text-base font-bold">Contact</h2>

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          placeholder="10-digit mobile number"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          {...field}
                          value={field.value ?? ''}
                          placeholder="supplier@example.com"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Address */}
              <div className="space-y-4">
                <h2 className="text-base font-bold">Address</h2>

                <FormField
                  control={form.control}
                  name="street"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pincode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pincode</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          placeholder="6-digit pincode"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Root error */}
              {form.formState.errors.root && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.root.message}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Save Changes'
                  )}
                </Button>
                <Button variant="outline" type="button" asChild>
                  <Link href="/suppliers">Back to Suppliers</Link>
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  )
}
