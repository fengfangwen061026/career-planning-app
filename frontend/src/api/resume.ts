import client from './client';
import type { ResumeParseResult, ResumeUploadResponse } from '../types/profiles';

export interface ResumeConfirmRequest {
  raw_text: string;
  education: ResumeParseResult['education'];
  experience: ResumeParseResult['experience'];
  projects: ResumeParseResult['projects'];
  skills: ResumeParseResult['skills'];
  certificates: ResumeParseResult['certificates'];
  awards: ResumeParseResult['awards'];
  self_intro: string | null;
  parse_confidence: number;
  missing_fields: string[];
}

export const resumeApi = {
  /**
   * Upload a resume file and parse it
   */
  uploadResume: (file: File, studentId?: number) => {
    const formData = new FormData();
    formData.append('file', file);
    return client.post<ResumeUploadResponse>('/resumes/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: studentId ? { student_id: studentId } : undefined,
    });
  },

  /**
   * Get resume details by ID
   */
  getResume: (resumeId: number) => {
    return client.get<{
      resume_id: number;
      student_id: number;
      filename: string;
      file_type: string;
      raw_text: string;
      parsed_json: ResumeParseResult;
      created_at: string;
    }>(`/resumes/${resumeId}`);
  },

  /**
   * Confirm and update the parsed resume result
   */
  confirmResume: (resumeId: number, data: ResumeConfirmRequest) => {
    return client.post<{ success: boolean }>(`/resumes/${resumeId}/confirm`, data);
  },
};
