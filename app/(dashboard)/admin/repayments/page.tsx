import { supabaseAdmin } from '@/lib/supabase/server'
import { repayNow } from './actions'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = supabaseAdmin() as any
  const { data: loans, error } = await supabase
    .from('loans')
    .select('*')
    .gt('outstanding_naira', 0)

  if (error) {
    return <div>Error loading loans</div>
  }

  return (
    <div>
      <h1>Repayments</h1>
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Outstanding (₦)</th>
            <th>Monthly Payment (₦)</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loans?.map((l: any) => (
            <tr key={l.id}>
              <td>{l.employee_id}</td>
              <td>{l.outstanding_naira ?? l.principal_naira}</td>
              <td>{l.monthly_payment_naira}</td>
              <td>
                <form
                  action={async (formData) => {
                    'use server'
                    const amount = Number(formData.get('amount'))
                    try {
                      await repayNow(l.id, amount)
                    } catch (e) {
                      console.error(e)
                    }
                  }}
                >
                  <input
                    type="number"
                    name="amount"
                    defaultValue={l.monthly_payment_naira}
                    step="0.01"
                  />
                  <button type="submit">Repay Now</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

