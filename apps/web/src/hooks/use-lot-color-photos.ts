import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

// The cloth photo of each colour of a lot (colour id → photo url), for screens that list quantities
// per colour but were not given the lot's colour rows.
export const useLotColorPhotos = (cuttingEntryId: string | null | undefined) => {
  const { data } = useQuery({
    queryKey: ['lot-color-photos', cuttingEntryId],
    queryFn: () => apiClient.get<Record<string, string>>(`/cutting/color-photos/${cuttingEntryId}`),
    enabled: Boolean(cuttingEntryId),
    staleTime: 5 * 60 * 1000,
  });
  return data ?? {};
};
