import { useQuery } from '@tanstack/react-query';
import { Users, Layers, Wallet, HandCoins, ImageOff } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
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

// `day` is a plain "YYYY-MM-DD" string from the API (see dashboard.repository.ts) — parsed
// manually rather than via `new Date(...)` to avoid the raw-SQL/local-timezone pitfall documented
// there.
const formatDayLabel = (day: string) => {
  const [, month, date] = day.split('-').map(Number);
  const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date} ${MONTH_SHORT[month - 1]}`;
};

const PIE_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];

const TILES = [
  { key: 'totalKarigars', label: 'Total Karigars', icon: Users, format: (v: number) => `${v}` },
  { key: 'todayPieces', label: "Today's Pieces", icon: Layers, format: (v: number) => `${v}` },
  { key: 'todayAmount', label: "Today's Amount", icon: Wallet, format: formatCurrency },
  { key: 'pendingPayment', label: 'Pending Payment', icon: HandCoins, format: formatCurrency },
] as const;

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
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TILES.map((tile) => (
              <Card key={tile.key}>
                <CardHeader className="flex-row items-center justify-between border-b-0 pb-0">
                  <CardTitle className="text-xs font-medium text-muted-foreground">{tile.label}</CardTitle>
                  <tile.icon className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="numeric text-2xl font-semibold">{tile.format(data?.[tile.key] ?? 0)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <Card>
              <CardHeader>
                <CardTitle>Production Trend</CardTitle>
                <CardDescription>Pieces produced over the last 7 days.</CardDescription>
              </CardHeader>
              <CardContent>
                {data?.productionTrend.some((p) => p.quantity > 0) ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={data.productionTrend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="day" tickFormatter={formatDayLabel} tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={36} />
                      <Tooltip
                        labelFormatter={(label) => formatDayLabel(String(label))}
                        formatter={(value) => [value as number, 'Pieces']}
                      />
                      <Line type="monotone" dataKey="quantity" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                    No production recorded in the last 7 days.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Work Type Split</CardTitle>
                <CardDescription>This month, by pieces.</CardDescription>
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
            <CardHeader>
              <CardTitle>Top Karigars</CardTitle>
              <CardDescription>Highest earners this month, by amount.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {data?.topKarigars.length ? (
                  data.topKarigars.map((karigar, index) => {
                    const photoUrl = resolvePhotoUrl(karigar.photoUrl);
                    return (
                      <div key={karigar.karigarId} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="w-5 shrink-0 text-center text-xs font-medium text-muted-foreground">
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
