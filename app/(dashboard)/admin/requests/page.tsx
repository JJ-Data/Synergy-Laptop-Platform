import { supabaseAdmin } from '@/lib/supabase/server'
import { approveRequest, rejectRequest } from './actions'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = supabaseAdmin() as any
  const { data: requests, error } = await supabase.from('requests').select('*')

  if (error) {
    return <div>Error loading requests</div>
  }

  return (
    <div>
      <h1>Requests</h1>
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Amount (₦)</th>
            <th>Interest %</th>
            <th>Duration (months)</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests?.map((r: any) => (
            <tr key={r.id}>
              <td>{r.employee_id}</td>
              <td>{r.amount_naira}</td>
              <td>{r.interest_rate}</td>
              <td>{r.duration_months}</td>
              <td>{r.status}</td>
              <td>
                {r.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <form
                      action={async () => {
                        'use server'
                        try {
                          await approveRequest(r.id)
                        } catch (e) {
                          console.error(e)
                        }
                      }}
                    >
                      <button type="submit">Approve</button>
                    </form>
                    <form
                      action={async () => {
                        'use server'
                        try {
                          await rejectRequest(r.id)
                        } catch (e) {
                          console.error(e)
                        }
                      }}
                    >
                      <button type="submit">Reject</button>
                    </form>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

