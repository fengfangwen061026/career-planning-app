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
      job_ids: data.job_ids,
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

  // Parse resume
  parseResume: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return client.post<{ parsed_data: Record<string, unknown> }>('/reports/parse-resume', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
