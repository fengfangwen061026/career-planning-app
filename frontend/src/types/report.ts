// Report types - aligned with backend/app/schemas/report.ts

export interface CareerReportBase {
  title?: string;
  summary?: string;
  recommendations?: Record<string, unknown>[];
  suggested_jobs?: Record<string, unknown>[];
  skill_gaps?: Record<string, unknown>[];
  career_path?: Record<string, unknown>[];
}

export interface CareerReportCreate extends CareerReportBase {
  student_id: string;
}

export interface CareerReportUpdate {
  title?: string;
  summary?: string;
  recommendations?: Record<string, unknown>[];
  suggested_jobs?: Record<string, unknown>[];
  skill_gaps?: Record<string, unknown>[];
  career_path?: Record<string, unknown>[];
  content_json?: Record<string, unknown>;
}

export interface CareerReportResponse extends CareerReportBase {
  id: string;
  student_id: string;
  pdf_path?: string;
  docx_path?: string;
  version?: string;
  status?: string;
  content_json?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ReportVersionBase {
  version: string;
  content: Record<string, unknown>;
  change_notes?: string;
}

export interface ReportVersionCreate extends ReportVersionBase {
  report_id: string;
}

export interface ReportVersionResponse extends ReportVersionBase {
  id: string;
  report_id: string;
  created_at: string;
}

export interface ReportGenerateRequest {
  student_id: string;
  job_profile_ids?: string[];
  include_export: boolean;
}

export interface ReportExportRequest {
  report_id: string;
  format: 'pdf' | 'docx';
}
