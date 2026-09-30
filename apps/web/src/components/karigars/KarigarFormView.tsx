import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { PageLayout } from '../../components/layout/PageLayout';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { FormField } from '../ui/form-field';
import { FormAlert } from '../ui/form-alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DatePicker } from '../ui/date-picker';
import { PhotoUpload } from '../common/PhotoUpload';
import type { Karigar, WorkType } from './karigar-constants';

interface KarigarFormViewProps {
  karigar: Karigar | null;
  onDone: () => void;
  onCancel: () => void;
}

const toDateInputValue = (value: string | null) => (value ? value.slice(0, 10) : '');

export const KarigarFormView = ({ karigar, onDone, onCancel }: KarigarFormViewProps) => {
  const isEdit = Boolean(karigar);
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    mobile: '',
    workTypeId: '',
    photoUrl: null as string | null,
    joinDate: '',
    isActive: true,
    address: '',
    remarks: '',
  });

  const { data: workTypes } = useQuery({
    queryKey: ['work-types'],
    queryFn: () => apiClient.get<WorkType[]>('/karigars/work-types'),
  });

  useEffect(() => {
    setError(null);
    setForm(
      karigar
        ? {
            fullName: karigar.fullName,
            mobile: karigar.mobile,
            workTypeId: karigar.workTypeId,
            photoUrl: karigar.photoUrl,
            joinDate: toDateInputValue(karigar.joinDate),
            isActive: karigar.isActive,
            address: karigar.address ?? '',
            remarks: karigar.remarks ?? '',
          }
        : {
            fullName: '',
            mobile: '',
            workTypeId: '',
            photoUrl: null,
            joinDate: '',
            isActive: true,
            address: '',
            remarks: '',
          },
    );
  }, [karigar]);

  // Default a new karigar to the first available work type once the list loads.
  useEffect(() => {
    if (!isEdit && !form.workTypeId && workTypes?.length) {
      setForm((f) => ({ ...f, workTypeId: workTypes[0].id }));
    }
  }, [isEdit, form.workTypeId, workTypes]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        fullName: form.fullName,
        mobile: form.mobile,
        workTypeId: form.workTypeId,
        photoUrl: form.photoUrl ?? undefined,
        joinDate: form.joinDate || undefined,
        address: form.address || undefined,
        remarks: form.remarks || undefined,
      };
      if (isEdit && karigar) {
        return apiClient.patch(`/karigars/${karigar.id}`, { ...payload, isActive: form.isActive });
      }
      return apiClient.post('/karigars', payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['karigars'] });
      onDone();
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.'),
  });

  return (
    <PageLayout title="Add / Edit Karigar" description="Workers who stitch, cut, finish and pack garments.">
      <Card>
        <CardContent>
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            {error ? <FormAlert tone="error">{error}</FormAlert> : null}

            <PhotoUpload value={form.photoUrl} onChange={(url) => setForm((f) => ({ ...f, photoUrl: url }))} />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Karigar Name" required>
                <Input
                  required
                  autoFocus
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                />
              </FormField>
              <FormField label="Code" hint={isEdit ? undefined : 'Assigned automatically on save.'}>
                <Input disabled value={karigar?.code ?? 'Auto-generated'} className="numeric" />
              </FormField>
              <FormField label="Mobile No" required>
                <Input
                  required
                  inputMode="tel"
                  value={form.mobile}
                  onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                />
              </FormField>
              <FormField label="Work Type" required>
                <Select value={form.workTypeId} onValueChange={(v) => setForm((f) => ({ ...f, workTypeId: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {workTypes?.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Join Date">
                <DatePicker value={form.joinDate} onChange={(joinDate) => setForm((f) => ({ ...f, joinDate }))} />
              </FormField>
              <FormField label="Status">
                <Select
                  value={form.isActive ? 'ACTIVE' : 'INACTIVE'}
                  onValueChange={(v) => setForm((f) => ({ ...f, isActive: v === 'ACTIVE' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <FormField label="Address">
              <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </FormField>

            <FormField label="Remarks">
              <Textarea value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
            </FormField>

            <div className="flex items-center gap-2 border-t border-border pt-4">
              <Button type="submit" loading={mutation.isPending} disabled={!form.workTypeId}>
                Save
              </Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageLayout>
  );
};
