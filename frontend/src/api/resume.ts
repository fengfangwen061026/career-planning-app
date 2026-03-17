import client from './client';
import type { ResumeParseResult } from '../types/profiles';
import type { ResumeUploadResponse } from '../types/student';

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

// 默认学生 UUID (demo student)
const DEFAULT_STUDENT_UUID = '9e882ecb-816d-4478-b836-4dcaf7bc1660';

export const resumeApi = {
  /**
   * Upload a resume file and parse it
   */
  uploadResume: (file: File, studentId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    // 使用学生端点，需要 UUID 格式的 student_id
    const studentUuid = studentId || DEFAULT_STUDENT_UUID;
    return client.post<ResumeUploadResponse>(`/students/${studentUuid}/upload-resume`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
  },

  /**
   * Get resume details by ID
   */
  getResume: (studentId: string, resumeId: string) => {
    return client.get<ResumeUploadResponse>(`/students/${studentId}/resumes/${resumeId}`);
  },

  /**
   * Confirm and update the parsed resume result
   */
  confirmResume: (_studentId: string, resumeId: string, data: ResumeConfirmRequest) => {
    return client.post<{ success: boolean }>(`/resumes/${resumeId}/confirm`, data);
  },
};
