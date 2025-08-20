'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function approveRequest(requestId: string) {
  const supabase = supabaseAdmin() as any

  const { data: request, error: fetchError } = await supabase
    .from('requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (fetchError || !request) {
    throw new Error('Request not found')
  }

  const { error: updateError } = await supabase
    .from('requests')
    .update({ status: 'approved' })
    .eq('id', requestId)

  if (updateError) {
    throw updateError
  }

  const { data: monthly, error: rpcError } = await supabase.rpc(
    'calculate_monthly_payment',
    {
      principal_cents: request.amount_naira * 100,
      annual_interest_rate: request.interest_rate,
      duration_months: request.duration_months,
    }
  )

  if (rpcError) {
    throw rpcError
  }

  const { error: insertError } = await supabase.from('loans').insert({
    request_id: request.id,
    employee_id: request.employee_id,
    principal_naira: request.amount_naira,
    monthly_payment_naira: (monthly || 0) / 100,
    duration_months: request.duration_months,
    status: 'active',
    outstanding_naira: request.amount_naira,
  })

  if (insertError) {
    throw insertError
  }

  revalidatePath('/(dashboard)/admin/requests')
}

export async function rejectRequest(requestId: string) {
  const supabase = supabaseAdmin() as any

  const { error } = await supabase
    .from('requests')
    .update({ status: 'rejected' })
    .eq('id', requestId)

  if (error) {
    throw error
  }

  revalidatePath('/(dashboard)/admin/requests')
}

