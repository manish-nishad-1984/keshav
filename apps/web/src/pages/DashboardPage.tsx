import { useQuery } from '@tanstack/react-query';
import { Users, Layers, Wallet, HandCoins, ImageOff, TrendingUp, PieChart as PieChartIcon, Trophy } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { apiClient, resolvePhotoUrl } from '../lib/api-client';
import { PageLayout } from '../components/layout/PageLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { LoadingState } from '../components/ui/loading-state';
import { formatDate } from '../lib/date';
import { cn } from '../lib/utils';

interface TopKarigar {
  karigarId: string;
  karigarName: string;
  karigarCode: string;
  photoUrl: string | null;
  totalQuantity: number;
  totalAmount: number;
}

interface WorkTypeSlice {
  workTypeId: string;
  workTypeName: string;
  totalQuantity: number;
}

interface TrendPoint {
  day: string;
  quantity: number;
  amount: number;
}

interface DashboardSummary {
  totalKarigars: number;
  todayPieces: number;
  todayAmount: number;
  pendingPayment: number;
  productionTrend: TrendPoint[];
  topKarigars: TopKarigar[];
  workTypeBreakdown: WorkTypeSlice[];
}

const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// `day` is a plain "YYYY-MM-DD" string from the API (see dashboard.repository.ts) — never parsed
// via `new Date(...)`, to avoid the raw-SQL/local-timezone pitfall documented there. Axis ticks
// use a short DD-MM; the tooltip shows the full DD-MM-YYYY.
const formatDayLabel = (day: string) => formatDate(day).slice(0, 5);

const PIE_COLORS = ['#0877cc', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];

// Each KPI tile has its own colour (theme status tokens, so dark mode follows automatically).
const TONES = {
  blue: { tile: 'border-status-info/30 bg-status-info/10', chip: 'bg-status-info', label: 'text-status-info' },
  violet: { tile: 'border-status-progress/30 bg-status-progress/10', chip: 'bg-status-progress', label: 'text-status-progress' },
  green: { tile: 'border-status-success/30 bg-status-success/10', chip: 'bg-status-success', label: 'text-status-success' },
  amber: { tile: 'border-status-warning/30 bg-status-warning/10', chip: 'bg-status-warning', label: 'text-status-warning' },
} as const;

const TILES = [
  { key: 'totalKarigars', label: 'Total Karigars', icon: Users, tone: 'blue', format: (v: number) => `${v}` },
  { key: 'todayPieces', label: "Today's Pieces", icon: Layers, tone: 'violet', format: (v: number) => `${v}` },
  { key: 'todayAmount', label: "Today's Amount", icon: Wallet, tone: 'green', format: formatCurrency },
  { key: 'pendingPayment', label: 'Pending Payment', icon: HandCoins, tone: 'amber', format: formatCurrency },
] as const;

// Small coloured icon chip shown before card titles.
const TitleIcon = ({ icon: Icon, className }: { icon: typeof Users; className: string }) => (
  <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-md', className)}>
    <Icon className="size-4" strokeWidth={1.9} />
  </span>
);

// Rank badges: top three highlighted (gold, silver, bronze-ish), the rest neutral.
const RANK_CLASSES = ['bg-status-warning text-white', 'bg-status-neutral text-white', 'bg-status-warning/25 text-status-warning'];

export const DashboardPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => apiClient.get<DashboardSummary>('/dashboard/summary'),
  });

  return (
    <PageLayout title="Dashboard" description="Today's production and payment overview.">
      {isLoading ? (
        <LoadingState variant="page" />
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TILES.map((tile) => {
              const tone = TONES[tile.tone];
              return (
                <Card key={tile.key} className={cn('flex items-center gap-3 p-4', tone.tile)}>
                  <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-lg text-white shadow-sm', tone.chip)}>
                    <tile.icon className="size-5" strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0">
                    <p className={cn('truncate text-xs font-semibold', tone.label)}>{tile.label}</p>
                    <p className="numeric text-2xl font-semibold leading-8 text-foreground">{tile.format(data?.[tile.key] ?? 0)}</p>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <Card>
              <CardHeader className="flex-row items-center gap-2.5">
                <TitleIcon icon={TrendingUp} className="bg-status-info/15 text-status-info" />
                <div>
                  <CardTitle>Production Trend</CardTitle>
                  <CardDescription>Pieces produced over the last 7 days.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {data?.productionTrend.some((p) => p.quantity > 0) ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={data.productionTrend}>
                      <defs>
                        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 0.3 }} />
                          <stop offset="100%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 0.02 }} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="day" tickFormatter={formatDayLabel} tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={36} />
                      <Tooltip
                        labelFormatter={(label) => formatDate(String(label))}
                        formatter={(value) => [value as number, 'Pieces']}
                      />
                      <Area
                        type="monotone"
                        dataKey="quantity"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#trendFill)"
                        dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                    No production recorded in the last 7 days.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center gap-2.5">
                <TitleIcon icon={PieChartIcon} className="bg-status-progress/15 text-status-progress" />
                <div>
                  <CardTitle>Work Type Split</CardTitle>
                  <CardDescription>This month, by pieces.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {data?.workTypeBreakdown.length ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={data.workTypeBreakdown}
                        dataKey="totalQuantity"
                        nameKey="workTypeName"
                        cx="50%"
                        cy="45%"
                        outerRadius={70}
                        label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                      >
                        {data.workTypeBreakdown.map((slice, index) => (
                          <Cell key={slice.workTypeId} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name) => [value as number, name as string]} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                    No production this month yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-center gap-2.5">
              <TitleIcon icon={Trophy} className="bg-status-warning/15 text-status-warning" />
              <div>
                <CardTitle>Top Karigars</CardTitle>
                <CardDescription>Highest earners this month, by amount.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {data?.topKarigars.length ? (
                  data.topKarigars.map((karigar, index) => {
                    const photoUrl = resolvePhotoUrl(karigar.photoUrl);
                    return (
                      <div key={karigar.karigarId} className="flex items-center gap-3 px-4 py-2.5">
                        <span
                          className={cn(
                            'flex size-6 shrink-0 items-center justify-center rounded-full text-2xs font-bold',
                            RANK_CLASSES[index] ?? 'bg-secondary text-muted-foreground',
                          )}
                        >
                          {index + 1}
                        </span>
                        <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-muted-foreground">
                          {photoUrl ? (
                            <img src={photoUrl} alt="" className="size-full object-cover" />
                          ) : (
                            <ImageOff className="size-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{karigar.karigarName}</p>
                          <p className="text-2xs text-muted-foreground">{karigar.karigarCode}</p>
                        </div>
                        <div className="text-right">
                          <p className="numeric text-sm font-semibold">{formatCurrency(karigar.totalAmount)}</p>
                          <p className="numeric text-2xs text-muted-foreground">{karigar.totalQuantity} pcs</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">No production this month yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageLayout>
  );
};
