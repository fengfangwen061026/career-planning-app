import client from './client';
import type { StudentProfileResponse } from '../types/student';

export interface GenerateProfileRequest {
  resume_id: string;
}

/**
 * Student Profile API
 * Single student profile operations
 */
export const studentApi = {
  /**
   * Get student profile by student ID
   */
  getStudentProfile: (studentId: string) =>
    client.get<StudentProfileResponse>(`/students/${studentId}/profile`),

  /**
   * Generate student profile from a specific resume
   */
  generateProfile: (studentId: string, data: GenerateProfileRequest) =>
    client.post<StudentProfileResponse>(
      `/students/${studentId}/profile/generate`,
      data
    ),
};
