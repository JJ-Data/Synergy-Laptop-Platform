'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function repayNow(loanId: string, amountNaira: number) {
  const supabase = supabaseAdmin() as any

  const { data: loan, error: loanError } = await supabase
    .from('loans')
    .select('*')
    .eq('id', loanId)
    .single()

  if (loanError || !loan) {
    return { ok: false, error: 'Loan not found' }
  }

  const { error: insertError } = await supabase.from('repayments').insert({
    loan_id: loanId,
    amount_naira: amountNaira,
    status: 'posted',
  })

  if (insertError) {
    return { ok: false, error: insertError.message }
  }

  const currentOutstanding = loan.outstanding_naira ?? loan.principal_naira ?? 0
  const newOutstanding = Math.max(currentOutstanding - amountNaira, 0)

  const { error: updateError } = await supabase
    .from('loans')
    .update({ outstanding_naira: newOutstanding })
    .eq('id', loanId)

  if (updateError) {
    return { ok: false, error: updateError.message }
  }

  revalidatePath('/(dashboard)/admin/repayments')

  return { ok: true }
}

