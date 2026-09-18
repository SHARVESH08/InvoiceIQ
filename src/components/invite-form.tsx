'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

import { inviteSubUser } from '@/lib/actions/invite'
import {
  INVITABLE_ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
} from '@/lib/auth/permissions'

const InviteSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  role: z.enum(INVITABLE_ROLES),
})

type FormValues = z.infer<typeof InviteSchema>

export function InviteForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(InviteSchema),
    defaultValues: { email: '', role: 'salesperson' },
    mode: 'onBlur',
  })

  async function onSubmit(values: FormValues) {
    const result = await inviteSubUser(values)
    if (result?.error) {
      toast.error('Failed to send invite. Please try again.')
      form.setError('root', { message: result.error })
      return
    }
    toast.success(`Invite sent to ${values.email}`)
    form.reset()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email address</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {INVITABLE_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      <span className="font-medium">{ROLE_LABELS[role]}</span>
                      <span className="block text-xs text-muted-foreground">
                        {ROLE_DESCRIPTIONS[role]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.formState.errors.root && (
          <p className="text-sm text-destructive">
            {form.formState.errors.root.message}
          </p>
        )}

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Send invite'
          )}
        </Button>
      </form>
    </Form>
  )
}
