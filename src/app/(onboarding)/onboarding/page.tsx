import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingProgress } from './_components/onboarding-progress'
import { GstinStep } from './_components/gstin-step'
import { CompanySetupStep } from './_components/company-setup-step'
import { AddProductStep } from './_components/add-product-step'
import { CreateInvoiceStep } from './_components/create-invoice-step'

interface OnboardingPageProps {
  searchParams: { step?: string }
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/business/login')
  }

  const { data: companyUser } = await supabase
    .from('company_users')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!companyUser) {
    redirect('/auth/business/login')
  }

  const { data: company } = await supabase
    .from('companies')
    .select('onboarding_step, onboarding_completed')
    .eq('id', companyUser.company_id)
    .single()

  if (company?.onboarding_completed) {
    redirect('/dashboard')
  }

  const urlStep = Number(searchParams.step) || 1
  const step = Math.max(urlStep, (company?.onboarding_step ?? 0) + 1)

  return (
    <div>
      <OnboardingProgress currentStep={step} />
      {step === 1 && <GstinStep companyId={companyUser.company_id} />}
      {step === 2 && <CompanySetupStep companyId={companyUser.company_id} />}
      {step === 3 && <AddProductStep companyId={companyUser.company_id} />}
      {step === 4 && <CreateInvoiceStep companyId={companyUser.company_id} />}
      {step < 1 || step > 4 ? redirect('/onboarding?step=1') : null}
    </div>
  )
}
