'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { updateCustomerProfile } from '@/lib/actions/customer-settings'

interface Props {
  fullName: string
  phone: string
  /** Read-only: it's the auth identity and the invoice-matching key. */
  email: string
}

export function ProfileSettings({ fullName, phone, email }: Props) {
  const [name, setName] = useState(fullName)
  const [phoneNumber, setPhoneNumber] = useState(phone)
  const [saving, setSaving] = useState(false)

  const dirty = name !== fullName || phoneNumber !== phone

  async function handleSave() {
    setSaving(true)
    const result = await updateCustomerProfile({
      full_name: name.trim(),
      phone: phoneNumber.trim(),
    })
    setSaving(false)

    if ('error' in result) {
      toast.error(result.error)
    } else {
      toast('Details saved')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">My Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="profile-name">Full name</Label>
          <Input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={100}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-phone">Phone</Label>
          <Input
            id="profile-phone"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="10-digit mobile number"
            inputMode="tel"
          />
          <p className="text-xs text-muted-foreground">
            Businesses use this to match invoices to your account.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" value={email} readOnly disabled />
          <p className="text-xs text-muted-foreground">
            Your email is how invoices are linked to this account, so it can&apos;t
            be changed here. Contact support if you need to update it.
          </p>
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={handleSave} disabled={saving || !dirty || !name.trim()}>
          {saving && <Loader2 className="mr-2 animate-spin" size={16} />}
          Save Details
        </Button>
      </CardFooter>
    </Card>
  )
}
