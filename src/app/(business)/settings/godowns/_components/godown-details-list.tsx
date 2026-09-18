'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

import { GodownSchema, type GodownInput } from '@/lib/schemas/godown'
import { updateGodown } from '@/lib/actions/godowns'

interface GodownDetail {
  id: string
  name: string
  address: string | null
  is_default: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// One inline form per godown. Each card keeps its own react-hook-form instance
// so dirty state (and the Save button) is tracked per godown rather than
// globally — editing one row shouldn't arm Save on the others.
// ─────────────────────────────────────────────────────────────────────────────

function GodownDetailCard({ godown }: { godown: GodownDetail }) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<GodownInput>({
    resolver: zodResolver(GodownSchema),
    defaultValues: { name: godown.name, address: godown.address ?? '' },
  })

  async function onSubmit(data: GodownInput) {
    setIsSubmitting(true)
    try {
      const result = await updateGodown(godown.id, data, '/settings/godowns')
      // A returned value means failure — success redirects server-side.
      if (result && 'error' in result) {
        toast.error(result.error, { duration: 6000 })
      }
    } catch {
      // Server action redirect throws NEXT_REDIRECT — that's the success path.
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">{godown.name}</h2>
              {godown.is_default && (
                <Badge variant="outline" className="text-xs">
                  Default
                </Badge>
              )}
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Name <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input maxLength={100} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Street, city, pin code"
                      rows={2}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || !form.formState.isDirty}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

export function GodownDetailsList({ godowns }: { godowns: GodownDetail[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('updated') === '1') {
      toast.success('Godown updated.')
      router.replace('/settings/godowns')
    }
  }, [searchParams, router])

  return (
    <div className="space-y-4">
      {godowns.map((g) => (
        // Keyed by id + name so a successful rename re-mounts the card and
        // resets its dirty state against the new server value.
        <GodownDetailCard key={`${g.id}:${g.name}`} godown={g} />
      ))}
    </div>
  )
}
