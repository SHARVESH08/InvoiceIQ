'use client'

import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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

import { GSTIN_REGEX, GSTIN_STATE_CODES, validateGstinChecksum } from '@/lib/gstin'
import { registerBusiness } from '@/lib/actions/auth-business'

const BusinessRegisterSchema = z.object({
  companyName: z.string().min(2, 'Company name is required'),
  gstin: z
    .string()
    .regex(GSTIN_REGEX, 'Invalid GSTIN format (e.g. 27AAPFU0939F1ZV)')
    .refine(validateGstinChecksum, 'GSTIN checksum is invalid'),
  companyType: z.enum(['OEM', 'Distributor', 'Retailer']),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type FormValues = z.infer<typeof BusinessRegisterSchema>

export default function BusinessRegisterPage() {
  const form = useForm<FormValues>({
    resolver: zodResolver(BusinessRegisterSchema),
    defaultValues: {
      companyName: '',
      gstin: '',
      companyType: 'Retailer',
      email: '',
      password: '',
    },
    mode: 'onBlur',
  })

  const gstinValue = form.watch('gstin')
  const stateName =
    gstinValue && GSTIN_REGEX.test(gstinValue) && validateGstinChecksum(gstinValue)
      ? GSTIN_STATE_CODES[gstinValue.slice(0, 2)] ?? null
      : null

  async function onSubmit(values: FormValues) {
    const result = await registerBusiness(values)
    if (result?.error) {
      form.setError('root', { message: result.error })
    }
    // success path: server action redirects to /dashboard, no client work
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Create your account</CardTitle>
        <CardDescription>Set up InvoiceIQ for your company</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Pvt Ltd" {...field} />
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
                      placeholder="27AAPFU0939F1ZV"
                      autoComplete="off"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormDescription>
                    15-character Goods and Services Tax Identification Number
                  </FormDescription>
                  {stateName && (
                    <p className="text-xs text-muted-foreground mt-1">
                      State: {stateName}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="companyType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select company type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="OEM">OEM</SelectItem>
                      <SelectItem value="Distributor">Distributor</SelectItem>
                      <SelectItem value="Retailer">Retailer</SelectItem>
                    </SelectContent>
                  </Select>
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
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.formState.errors.root && (
              <p className="text-sm text-destructive text-center">
                {form.formState.errors.root.message}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Create business account'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="text-center justify-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            href="/auth/business/login"
            className="underline underline-offset-4 hover:text-primary"
          >
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
