import { type QueryClient, useQuery } from '@tanstack/react-query';
import { api } from './api';

// All list variants (including other pages/scopes) depend on catalog writes.
export const adminCatalogKey = ['admin-catalog'] as const;

export async function refreshCatalogQueries(client: QueryClient) {
  // A GET already in flight may have read the catalog before the write committed.
  await client.cancelQueries({ queryKey: adminCatalogKey });
  // Sorting, eligibility and totals can change on any page. Do not flash
  // obsolete rows from hidden lists when the operator next opens them.
  client.removeQueries({ queryKey: adminCatalogKey, type: 'inactive' });
  await client.invalidateQueries({ queryKey: adminCatalogKey });
}

export function useCatalogQuery<T>(
  path: string,
  params: Record<string, string>,
  enabled: boolean,
  poll = false,
) {
  return useQuery({
    queryKey: [...adminCatalogKey, path, params],
    queryFn: ({ signal }) => {
      const search = new URLSearchParams(params).toString();
      return api<T>(search ? path + '?' + search : path, { signal });
    },
    enabled,
    staleTime: 30_000,
    gcTime: 300_000,
    retry: false,
    refetchInterval: enabled && poll ? 30_000 : false,
  });
}
