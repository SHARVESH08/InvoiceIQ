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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CustomerSchema, type CustomerInput } from '@/lib/schemas/customer'
import { createCustomer } from '@/lib/actions/customers'
import { validateGstin, GSTIN_STATE_CODES } from '@/lib/gstin'

export default function CreateCustomerPage() {
  const [gstinStateName, setGstinStateName] = useState<string | null>(null)

  const form = useForm<CustomerInput>({
    resolver: zodResolver(CustomerSchema) as Resolver<CustomerInput>,
    defaultValues: {
      name: '',
      customer_type: 'b2c',
      gstin: '',
      phone: '',
      email: '',
      state_code: '',
      credit_limit: 0,
      billing_street: '',
      billing_city: '',
      billing_pincode: '',
    },
    mode: 'onBlur',
  })

  async function onSubmit(values: CustomerInput) {
    const result = await createCustomer(values)
    if (result?.error) {
      form.setError('root', { message: result.error })
    }
    // On success: createCustomer redirects server-side — client code below never runs
  }

  return (
    <main className="flex-1 p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <Link href="/customers">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Customers
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Create Customer</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              {/* Basic Information */}
              <div className="space-y-4">
                <h2 className="text-base font-bold">Basic Information</h2>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Acme Corp" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customer_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="b2b">B2B (Business)</SelectItem>
                          <SelectItem value="b2c">B2C (Consumer)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Contact & Tax */}
              <div className="space-y-4">
                <h2 className="text-base font-bold">Contact &amp; Tax</h2>

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
                        15-character GST Identification Number (B2B customers only)
                        {gstinStateName && (
                          <span className="ml-2 text-foreground font-medium">
                            State: {gstinStateName}
                          </span>
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                          placeholder="customer@example.com"
                        />
                      </FormControl>
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

              {/* Address */}
              <div className="space-y-4">
                <h2 className="text-base font-bold">Address</h2>

                <FormField
                  control={form.control}
                  name="billing_street"
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
                  name="billing_city"
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
                  name="billing_pincode"
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

              {/* Credit */}
              <div className="space-y-4">
                <h2 className="text-base font-bold">Credit</h2>

                <FormField
                  control={form.control}
                  name="credit_limit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Credit Limit (₹)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
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
                    'Save Customer'
                  )}
                </Button>
                <Button variant="outline" type="button" asChild>
                  <Link href="/customers">Back to Customers</Link>
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  )
}
