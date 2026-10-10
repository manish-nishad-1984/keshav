import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
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
import { KarigarDocumentsSection, newDocumentDraft } from './KarigarDocumentsSection';
import type { DocumentDraft } from './KarigarDocumentsSection';
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
    salaryType: 'VARIABLE' as 'FIXED' | 'VARIABLE',
    photoUrl: null as string | null,
    joinDate: '',
    isActive: true,
    address: '',
    remarks: '',
    monthlySalary: '',
  });

  const [documents, setDocuments] = useState<DocumentDraft[]>([]);

  // Lists don't carry ID proofs; load them for the karigar being edited.
  const { data: details } = useQuery({
    queryKey: ['karigars', 'detail', karigar?.id],
    queryFn: () => apiClient.get<Karigar>(`/karigars/${karigar!.id}`),
    enabled: isEdit,
  });

  useEffect(() => {
    setDocuments(details?.documents?.map((d) => newDocumentDraft(d.type, d.fileUrl, d.label ?? '')) ?? []);
  }, [details]);

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
            salaryType: karigar.salaryType,
            photoUrl: karigar.photoUrl,
            joinDate: toDateInputValue(karigar.joinDate),
            isActive: karigar.isActive,
            address: karigar.address ?? '',
            remarks: karigar.remarks ?? '',
            monthlySalary: karigar.monthlySalary ? String(Number(karigar.monthlySalary)) : '',
          }
        : {
            fullName: '',
            mobile: '',
            workTypeId: '',
            salaryType: 'VARIABLE',
            photoUrl: null,
            joinDate: '',
            isActive: true,
            address: '',
            remarks: '',
            monthlySalary: '',
          },
    );
  }, [karigar]);

  // Default a new karigar to the first available work type once the list loads.
  useEffect(() => {
    const firstActive = workTypes?.find((w) => w.isActive);
    if (!isEdit && !form.workTypeId && firstActive) {
      setForm((f) => ({ ...f, workTypeId: firstActive.id }));
    }
  }, [isEdit, form.workTypeId, workTypes]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        fullName: form.fullName,
        mobile: form.mobile,
        workTypeId: form.workTypeId,
        salaryType: form.salaryType,
        photoUrl: form.photoUrl ?? undefined,
        joinDate: form.joinDate || undefined,
        address: form.address || undefined,
        remarks: form.remarks || undefined,
        // Only Fixed karigars carry a monthly salary.
        monthlySalary: isFixedType && form.monthlySalary ? Number(form.monthlySalary) : null,
        // A proof without a photo is just an empty slot — not sent.
        documents: documents
          .filter((d) => d.fileUrl)
          .map((d) => ({ type: d.type, label: d.type === 'OTHER' ? d.label.trim() : null, fileUrl: d.fileUrl })),
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

  const isFixedType = form.salaryType === 'FIXED';
  // Hidden work types (e.g. the retired "Fixed") stay selectable only for a karigar already on one.
  const selectableWorkTypes = workTypes?.filter((w) => w.isActive || w.id === karigar?.workTypeId);
  const unnamedProof = documents.some((d) => d.type === 'OTHER' && d.fileUrl && !d.label.trim());

  return (
    <PageLayout title="Add / Edit Karigar" description="Workers who stitch, cut, finish and pack garments.">
      <Card>
        <CardContent className="p-3 sm:p-4">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            {error ? <FormAlert tone="error">{error}</FormAlert> : null}
            {unnamedProof ? <FormAlert tone="error">Give each other proof a name (e.g. Voter ID) before saving.</FormAlert> : null}

            {/* Photo beside the identity fields on desktop; stacked on mobile. */}
            <div className="grid gap-x-5 gap-y-3 md:grid-cols-[auto_minmax(0,1fr)]">
              <PhotoUpload
                className="md:flex-col md:items-start md:pt-5"
                value={form.photoUrl}
                onChange={(url) => setForm((f) => ({ ...f, photoUrl: url }))}
              />

            <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
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
                    {selectableWorkTypes?.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Salary Type" required>
                <Select value={form.salaryType} onValueChange={(v) => setForm((f) => ({ ...f, salaryType: v as 'FIXED' | 'VARIABLE' }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VARIABLE">Variable</SelectItem>
                    <SelectItem value="FIXED">Fixed</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              {isFixedType ? (
                <FormField label="Monthly Salary (₹)" required hint="Paid by attendance: per day = salary ÷ 30">
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="decimal"
                    required
                    className="numeric text-right"
                    value={form.monthlySalary}
                    onChange={(e) => setForm((f) => ({ ...f, monthlySalary: e.target.value }))}
                  />
                </FormField>
              ) : null}
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
              <FormField label="Address" className="sm:col-span-2 lg:col-span-3">
                <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </FormField>
            </div>
            </div>

            <KarigarDocumentsSection documents={documents} onChange={setDocuments} />

            <FormField label="Remarks">
              <Textarea
                rows={2}
                className="min-h-14 resize-y"
                value={form.remarks}
                onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              />
            </FormField>

            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" loading={mutation.isPending} disabled={!form.workTypeId || unnamedProof}>
                <Save />
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
