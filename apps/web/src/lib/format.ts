// Rupee amounts on screen: Indian digit grouping, always two decimals (e.g. 2,73,624.00).
// CSV exports keep plain toFixed(2) so spreadsheets read them as numbers.
export const formatMoney = (value: number | string | null | undefined) =>
  Number(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
