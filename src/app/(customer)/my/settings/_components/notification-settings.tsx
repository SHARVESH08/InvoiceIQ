'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { updateEmailReminders } from '@/lib/actions/customer-settings'

interface Props {
  emailReminders: boolean
}

export function NotificationSettings({ emailReminders }: Props) {
  const [enabled, setEnabled] = useState(emailReminders)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const result = await updateEmailReminders({ email_reminders: enabled })
    setSaving(false)
    if ('error' in result) {
      toast.error('Failed to save preferences. Please try again.')
    } else {
      toast('Preferences saved')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Email Notifications</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-3">
          <Switch
            id="email-reminders"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
          <div className="space-y-1">
            <Label htmlFor="email-reminders" className="font-medium">
              Email payment reminders
            </Label>
            <p className="text-sm text-muted-foreground">
              Receive email reminders for unpaid invoices
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 animate-spin" size={16} />}
          Save Preferences
        </Button>
      </CardFooter>
    </Card>
  )
}
