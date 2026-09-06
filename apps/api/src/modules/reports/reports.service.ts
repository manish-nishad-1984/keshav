import * as repo from './reports.repository';
import type { ReportDateRangeQuery } from './reports.schema';

export const getKarigarSummary = (organizationId: string, query: ReportDateRangeQuery) =>
  repo.getKarigarSummary(organizationId, query.dateFrom, query.dateTo);

export const getItemSummary = (organizationId: string, query: ReportDateRangeQuery) =>
  repo.getItemSummary(organizationId, query.dateFrom, query.dateTo);

export const getMonthlySummary = (organizationId: string, query: ReportDateRangeQuery) =>
  repo.getMonthlySummary(organizationId, query.dateFrom, query.dateTo);
