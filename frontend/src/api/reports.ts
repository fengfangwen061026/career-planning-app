import client from './client';
import type {
  CareerReportResponse,
  CareerReportCreate,
  CareerReportUpdate,
  ReportGenerateRequest,
  ReportExportRequest,
  ReportVersionResponse,
} from '../types/report';

export const reportsApi = {
  // Get all reports
  getReports: (params?: { student_id?: string; skip?: number; limit?: number }) =>
    client.get<CareerReportResponse[]>('/reports/', { params }),

  // Get specific report
  getReport: (id: string) =>
    client.get<CareerReportResponse>(`/reports/${id}`),

  // Create report
  createReport: (data: CareerReportCreate) =>
    client.post<CareerReportResponse>('/reports/', data),

  // Update report
  updateReport: (id: string, data: CareerReportUpdate) =>
    client.put<CareerReportResponse>(`/reports/${id}`, data),

  // Delete report
  deleteReport: (id: string) =>
    client.delete(`/reports/${id}`),

  // Generate report with AI (uses path parameter for student_id)
  generateReport: (data: ReportGenerateRequest) =>
    client.post<CareerReportResponse>(`/reports/generate/${data.student_id}`, {
      include_export: data.include_export,
      job_profile_ids: data.job_profile_ids,
    }),

  // Export report
  exportReport: (data: ReportExportRequest) =>
    client.post(`/reports/${data.report_id}/export`, null, {
      params: { format: data.format },
      responseType: 'blob',
    }),

  // Report versions
  getReportVersions: (reportId: string) =>
    client.get<ReportVersionResponse[]>(`/reports/${reportId}/versions`),

  buildGenerateReportStreamUrl: (studentId: string, jobProfileId?: string) => {
    const params = new URLSearchParams({ student_id: studentId });
    if (jobProfileId) {
      params.set('job_profile_id', jobProfileId);
    }
    return `/api/reports/generate/stream?${params.toString()}`;
  },

  // Polish report with AI
  polishReport: (reportId: string) =>
    client.post<{ polished: boolean; changes: string[]; version: string }>(
      `/reports/${reportId}/polish`
    ),

  // Check report completeness
  checkReportCompleteness: (reportId: string) =>
    client.post<{ complete: boolean; missing_items: string[]; suggestions: string[]; chapter_count: number }>(
      `/reports/${reportId}/check`
    ),
};
