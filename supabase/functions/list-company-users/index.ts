import { createClient, type User } from 'https://esm.sh/@supabase/supabase-js@2'

interface UserRole {
  user_id: string
  role: string
}

interface Profile {
  id: string
  display_name: string | null
  created_at: string
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '')

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { companyId } = await req.json()
    if (!companyId) {
      return new Response(JSON.stringify({ error: 'Missing companyId' }), { status: 400 })
    }

    const { data: roleCheck, error: roleError } = await supabaseAdmin
      .from<UserRole>('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (roleError || !roleCheck) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    }

    const { data: userRoles, error: rolesError } = await supabaseAdmin
      .from<UserRole>('user_roles')
      .select('user_id, role')
      .eq('company_id', companyId)
    if (rolesError) throw rolesError

    if (!userRoles?.length) {
      return new Response(JSON.stringify({ users: [] }), { headers: { 'Content-Type': 'application/json' } })
    }

    const userIds = userRoles.map((r) => r.user_id)

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from<Profile>('profiles')
      .select('id, display_name, created_at')
      .in('id', userIds)
    if (profilesError) throw profilesError

    const { data: authUsersData, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers()
    if (authUsersError) throw authUsersError
    const authUsers: User[] = authUsersData?.users ?? []

    const users = userRoles.map((roleData) => {
      const profile = profiles?.find((p) => p.id === roleData.user_id)
      const authUser = authUsers.find((u) => u.id === roleData.user_id)
      return {
        id: roleData.user_id,
        email: authUser?.email || '',
        display_name: profile?.display_name || undefined,
        role: roleData.role,
        created_at: authUser?.created_at || profile?.created_at || ''
      }
    })

    return new Response(
      JSON.stringify({ users }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})

