import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, MessageCircle, Printer } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { downloadBlob, elementToPdf } from '../../lib/pdf';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { FormAlert } from '../ui/form-alert';
import { LoadingState } from '../ui/loading-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { WhatsAppSendDialog } from '../common/WhatsAppSendDialog';
import { formatDate } from '../../lib/date';
import { formatMoney } from '../../lib/format';
import { PAYMENT_MODE_LABELS, type PaymentMode } from './payment-constants';

interface Statement {
  karigar: { id: string; code: string; name: string; mobile: string; workType: string; salaryType: 'FIXED' | 'VARIABLE'; monthlySalary: number | null };
  range: { dateFrom: string | null; dateTo: string | null };
  work: { date: string; lot: string; design: string; work: string; qty: number; rate: number; amount: number }[];
  salaries: { date: string; presentDays: number | null; absentDays: number | null; overtimeHours: number; perDayRate: number; amount: number }[];
  payments: { date: string; entryTime: string | null; amount: number; mode: PaymentMode; kind: 'SALARY' | 'UPAD'; remarks: string | null }[];
  totals: { opening: number; pieces: number; workTotal: number; salaryTotal: number; earned: number; paid: number; paidTimes: number; closing: number };
}

type Period = 'this' | 'last' | 'all' | 'custom';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const periodRange = (p: Period, custom: { from: string; to: string }) => {
  const now = new Date();
  if (p === 'this') return { dateFrom: iso(new Date(now.getFullYear(), now.getMonth(), 1)), dateTo: iso(now) };
  if (p === 'last') return { dateFrom: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), dateTo: iso(new Date(now.getFullYear(), now.getMonth(), 0)) };
  if (p === 'custom') return { ...(custom.from ? { dateFrom: custom.from } : {}), ...(custom.to ? { dateTo: custom.to } : {}) };
  return {};
};

// Shown as "₹ 500 advance" when the karigar has taken more than earned.
const balance = (n: number) => (n < 0 ? `${formatMoney(-n)} advance` : formatMoney(n));

interface KarigarStatementViewProps {
  karigarId: string;
  onBack: () => void;
}

// The karigar's report card: work done lot by lot with rates, salary, every payment / upad taken, and
// what is left — for a chosen period. Print, PDF, or WhatsApp it (with the PDF).
export const KarigarStatementView = ({ karigarId, onBack }: KarigarStatementViewProps) => {
  const [period, setPeriod] = useState<Period>('this');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const range = periodRange(period, custom);

  const { data, isLoading } = useQuery({
    queryKey: ['payments', 'statement', karigarId, range],
    queryFn: () => apiClient.get<Statement>(`/payments/karigar/${karigarId}/statement`, range),
  });

  const fileName = data ? `Report-${data.karigar.name.replace(/\s+/g, '-')}-${range.dateFrom ?? 'start'}-${range.dateTo ?? 'today'}.pdf` : 'Report.pdf';
  const makePdf = async () => {
    if (!sheetRef.current) throw new Error('not ready');
    return elementToPdf(sheetRef.current);
  };
  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      downloadBlob(await makePdf(), fileName);
    } catch {
      setError('Could not make the PDF. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const periodText = range.dateFrom || range.dateTo ? `${range.dateFrom ? formatDate(range.dateFrom) : 'Start'} – ${range.dateTo ? formatDate(range.dateTo) : 'Today'}` : 'All time';

  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap items-end justify-between gap-2">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft />
          Back to Ledger
        </Button>
        <div className="flex flex-wrap items-end gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-40" aria-label="Period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this">This month</SelectItem>
              <SelectItem value="last">Last month</SelectItem>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="custom">Choose dates</SelectItem>
            </SelectContent>
          </Select>
          {period === 'custom' ? (
            <>
              <Input type="date" aria-label="From" className="w-40" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
              <Input type="date" aria-label="To" className="w-40" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </>
          ) : null}
          <Button variant="outline" onClick={() => window.print()} disabled={!data}>
            <Printer />
            Print
          </Button>
          <Button variant="outline" onClick={() => void download()} loading={busy} disabled={!data}>
            <Download />
            PDF
          </Button>
          <Button onClick={() => setSendOpen(true)} disabled={!data} className="bg-emerald-600 text-white hover:bg-emerald-700">
            <MessageCircle />
            WhatsApp
          </Button>
        </div>
      </div>
      {error ? (
        <div className="no-print">
          <FormAlert tone="error">{error}</FormAlert>
        </div>
      ) : null}

      {isLoading || !data ? (
        <LoadingState variant="page" />
      ) : (
        <Card ref={sheetRef} className="print-area mx-auto max-w-4xl space-y-4 bg-card p-4 text-sm sm:p-6">
          <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Karigar Report Card</p>
              <h2 className="text-xl font-bold">
                {data.karigar.name} <span className="text-sm font-normal text-muted-foreground">({data.karigar.code})</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                {data.karigar.workType} · {data.karigar.salaryType === 'FIXED' ? `Fixed salary ${formatMoney(data.karigar.monthlySalary)} / month` : 'Per piece'}
                {data.karigar.mobile ? ` · ${data.karigar.mobile}` : ''}
              </p>
            </div>
            <p className="numeric text-sm font-medium">{periodText}</p>
          </header>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Opening balance', value: balance(data.totals.opening), tone: '' },
              { label: `Earned (${data.totals.pieces} pcs)`, value: formatMoney(data.totals.earned), tone: 'text-emerald-700 dark:text-emerald-400' },
              { label: `Taken (${data.totals.paidTimes} times)`, value: formatMoney(data.totals.paid), tone: 'text-sky-700 dark:text-sky-400' },
              { label: data.totals.closing < 0 ? 'Advance (taken extra)' : 'Balance to pay', value: balance(data.totals.closing), tone: 'text-primary' },
            ].map((t) => (
              <div key={t.label} className="rounded-lg border border-border px-3 py-2">
                <p className="text-2xs uppercase tracking-wider text-muted-foreground">{t.label}</p>
                <p className={`numeric text-lg font-bold ${t.tone}`}>{t.value}</p>
              </div>
            ))}
          </div>

          <section>
            <h3 className="mb-1.5 text-sm font-semibold">Work done</h3>
            {data.work.length ? (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-foreground/60 text-left text-xs">
                    <th className="px-2 py-1">Date</th>
                    <th className="px-2 py-1">Lot</th>
                    <th className="px-2 py-1">Design</th>
                    <th className="px-2 py-1">Work</th>
                    <th className="px-2 py-1 text-right">Pcs</th>
                    <th className="px-2 py-1 text-right">Rate</th>
                    <th className="px-2 py-1 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.work.map((w, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="numeric whitespace-nowrap px-2 py-1">{formatDate(w.date)}</td>
                      <td className="numeric px-2 py-1 font-medium">{w.lot || '—'}</td>
                      <td className="px-2 py-1">{w.design || '—'}</td>
                      <td className="px-2 py-1">{w.work}</td>
                      <td className="numeric px-2 py-1 text-right">{w.qty}</td>
                      <td className="numeric px-2 py-1 text-right">{w.rate ? formatMoney(w.rate) : '—'}</td>
                      <td className="numeric px-2 py-1 text-right font-medium">{formatMoney(w.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td className="px-2 py-1" colSpan={4}>
                      Total
                    </td>
                    <td className="numeric px-2 py-1 text-right">{data.totals.pieces}</td>
                    <td />
                    <td className="numeric px-2 py-1 text-right">{formatMoney(data.totals.workTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <p className="text-xs text-muted-foreground">No work entries in this period.</p>
            )}
          </section>

          {data.salaries.length ? (
            <section>
              <h3 className="mb-1.5 text-sm font-semibold">Salary</h3>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-foreground/60 text-left text-xs">
                    <th className="px-2 py-1">Date</th>
                    <th className="px-2 py-1 text-right">Present</th>
                    <th className="px-2 py-1 text-right">Absent</th>
                    <th className="px-2 py-1 text-right">OT (h)</th>
                    <th className="px-2 py-1 text-right">Per day</th>
                    <th className="px-2 py-1 text-right">Salary</th>
                  </tr>
                </thead>
                <tbody>
                  {data.salaries.map((s, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="numeric px-2 py-1">{formatDate(s.date)}</td>
                      <td className="numeric px-2 py-1 text-right">{s.presentDays ?? 0}</td>
                      <td className="numeric px-2 py-1 text-right">{s.absentDays ?? 0}</td>
                      <td className="numeric px-2 py-1 text-right">{s.overtimeHours}</td>
                      <td className="numeric px-2 py-1 text-right">{formatMoney(s.perDayRate)}</td>
                      <td className="numeric px-2 py-1 text-right font-medium">{formatMoney(s.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          <section>
            <h3 className="mb-1.5 text-sm font-semibold">Money taken</h3>
            {data.payments.length ? (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-foreground/60 text-left text-xs">
                    <th className="px-2 py-1">Date</th>
                    <th className="px-2 py-1">Type</th>
                    <th className="px-2 py-1">Mode</th>
                    <th className="px-2 py-1">Remarks</th>
                    <th className="px-2 py-1 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((p, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="numeric whitespace-nowrap px-2 py-1">
                        {formatDate(p.date)}
                        {p.entryTime ? ` ${p.entryTime}` : ''}
                      </td>
                      <td className="px-2 py-1">
                        {p.kind === 'SALARY' ? (
                          <Badge variant="success">Salary</Badge>
                        ) : data.karigar.salaryType === 'FIXED' ? (
                          <Badge variant="info">Upad</Badge>
                        ) : (
                          <Badge variant="muted">Payment</Badge>
                        )}
                      </td>
                      <td className="px-2 py-1">{PAYMENT_MODE_LABELS[p.mode]}</td>
                      <td className="px-2 py-1 text-muted-foreground">{p.remarks || '—'}</td>
                      <td className="numeric px-2 py-1 text-right font-medium">{formatMoney(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td className="px-2 py-1" colSpan={4}>
                      Total taken ({data.totals.paidTimes} times)
                    </td>
                    <td className="numeric px-2 py-1 text-right">{formatMoney(data.totals.paid)}</td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <p className="text-xs text-muted-foreground">No money taken in this period.</p>
            )}
          </section>

          <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 border-t-2 border-foreground/60 pt-2 text-sm">
            <span>
              Opening <span className="numeric font-semibold">{balance(data.totals.opening)}</span>
            </span>
            <span>
              + Earned <span className="numeric font-semibold">{formatMoney(data.totals.earned)}</span>
            </span>
            <span>
              − Taken <span className="numeric font-semibold">{formatMoney(data.totals.paid)}</span>
            </span>
            <span className="font-bold">
              = {data.totals.closing < 0 ? 'Advance' : 'Balance'} <span className="numeric text-primary">{balance(data.totals.closing)}</span>
            </span>
          </div>
        </Card>
      )}

      {data ? (
        <WhatsAppSendDialog
          event="KARIGAR_STATEMENT"
          refId={sendOpen ? karigarId : null}
          params={range}
          title={`Send report card of ${data.karigar.name}`}
          onOpenChange={setSendOpen}
          makeAttachment={async () => new File([await makePdf()], fileName, { type: 'application/pdf' })}
        />
      ) : null}
    </div>
  );
};
