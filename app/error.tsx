'use client';

import { useEffect } from 'react';

export default function Error({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="p-4 space-y-2">
      <h2 className="text-lg font-semibold">Something went wrong.</h2>
      <p>{error.message}</p>
      {error.digest && <p>Digest: {error.digest}</p>}
    </div>
  );
}
