import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let db = 'skipped';

  if (url && anonKey) {
    const supabase = createClient(url, anonKey);
    const { error } = await supabase.from('companies').select('id').limit(1);
    db = error ? `error: ${error.message}` : 'ok';
  }

  return (
    <pre>
{`url: ${Boolean(url)}\nkey: ${Boolean(anonKey)}\ndb: ${db}`}
    </pre>
  );
}
