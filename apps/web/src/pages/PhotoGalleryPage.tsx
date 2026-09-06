import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ImageOff } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { LoadingState } from '../components/ui/loading-state';
import { Pagination } from '../components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ProductionEntryViewDialog } from '../components/production-entries/ProductionEntryViewDialog';
import type { ProductionEntry } from '../components/production-entries/production-entry-constants';
import type { Karigar } from '../components/karigars/karigar-constants';
import type { Item } from '../components/items/item-constants';

const API_ORIGIN = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/api\/v1\/?$/, '');
const resolvePhotoUrl = (url: string | null) => (url ? (url.startsWith('http') ? url : `${API_ORIGIN}${url}`) : null);

export const PhotoGalleryPage = () => {
  const [date, setDate] = useState('');
  const [karigarId, setKarigarId] = useState('ALL');
  const [itemId, setItemId] = useState('ALL');
  const [page, setPage] = useState(1);
  const [viewEntry, setViewEntry] = useState<ProductionEntry | null>(null);

  const { data: karigars } = useQuery({
    queryKey: ['karigars', 'options'],
    queryFn: () => apiClient.list<Karigar>('/karigars', { page: 1, pageSize: 100 }),
  });
  const { data: items } = useQuery({
    queryKey: ['items', 'options'],
    queryFn: () => apiClient.list<Item>('/items', { page: 1, pageSize: 100 }),
  });

  const filters = {
    dateFrom: date || undefined,
    dateTo: date || undefined,
    karigarId: karigarId === 'ALL' ? undefined : karigarId,
    itemId: itemId === 'ALL' ? undefined : itemId,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['production-entries', 'gallery', { page, ...filters }],
    queryFn: () => apiClient.list<ProductionEntry>('/production-entries', { page, pageSize: 24, ...filters }),
  });

  const photos = data?.items.filter((entry) => entry.photoUrl) ?? [];

  return (
    <PageLayout title="Photo Gallery" description="Browse production photos by date, karigar, or item.">
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <Input
            type="date"
            className="w-40"
            value={date}
            onChange={(e) => {
              setPage(1);
              setDate(e.target.value);
            }}
          />
          <Select
            value={karigarId}
            onValueChange={(v) => {
              setPage(1);
              setKarigarId(v);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Karigar</SelectItem>
              {karigars?.items.map((karigar) => (
                <SelectItem key={karigar.id} value={karigar.id}>
                  {karigar.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={itemId}
            onValueChange={(v) => {
              setPage(1);
              setItemId(v);
            }}
          >
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Item</SelectItem>
              {items?.items.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.styleNo} — {item.itemName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <LoadingState variant="page" />
        ) : photos.length ? (
          <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((entry) => {
              const photoUrl = resolvePhotoUrl(entry.photoUrl);
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setViewEntry(entry)}
                  className="group overflow-hidden rounded-md border border-border text-left transition-colors hover:border-primary"
                >
                  <div className="aspect-square overflow-hidden bg-muted text-muted-foreground">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={entry.item.styleNo}
                        className="size-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <ImageOff className="size-6" />
                      </div>
                    )}
                  </div>
                  <div className="px-2 py-1.5">
                    <p className="numeric text-xs font-medium">{entry.item.styleNo}</p>
                    <p className="text-2xs text-muted-foreground">{new Date(entry.date).toLocaleDateString()}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">No photos found.</p>
        )}

        {data ? <Pagination meta={data.pagination} onPageChange={setPage} className="border-t border-border" /> : null}
      </Card>

      <ProductionEntryViewDialog entry={viewEntry} onOpenChange={(open) => !open && setViewEntry(null)} onDeleted={() => setViewEntry(null)} />
    </PageLayout>
  );
};
