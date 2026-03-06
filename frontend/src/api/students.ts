import client from './client';
import type {
  StudentResponse,
  StudentCreate,
  StudentUpdate,
  ResumeResponse,
  ResumeUploadResponse,
  StudentProfileResponse,
  StudentProfileCreate,
} from '../types/student';

export const studentsApi = {
  // Student CRUD
  getStudents: (params?: { skip?: number; limit?: number }) =>
    client.get<StudentResponse[]>('/students/', { params }),

  getStudent: (id: string) =>
    client.get<StudentResponse>(`/students/${id}`),

  createStudent: (data: StudentCreate) =>
    client.post<StudentResponse>('/students/', data),

  updateStudent: (id: string, data: StudentUpdate) =>
    client.patch<StudentResponse>(`/students/${id}`, data),

  deleteStudent: (id: string) =>
    client.delete(`/students/${id}`),

  // Resume
  getResumes: (studentId: string) =>
    client.get<ResumeResponse[]>(`/students/${studentId}/resumes`),

  uploadResume: (studentId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return client.post<ResumeUploadResponse>(`/students/${studentId}/upload-resume`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  deleteResume: (studentId: string, resumeId: string) =>
    client.delete(`/students/${studentId}/resumes/${resumeId}`),

  // Student Profile
  getStudentProfile: (id: string) =>
    client.get<StudentProfileResponse>(`/students/${id}/profile`),

  createStudentProfile: (id: string, data: Partial<StudentProfileCreate>) =>
    client.put<StudentProfileResponse>(`/students/${id}/profile`, {
      profile_json: data,
    }),

  updateStudentProfile: (id: string, data: Partial<StudentProfileCreate>) =>
    client.put<StudentProfileResponse>(`/students/${id}/profile`, {
      profile_json: data,
    }),
};
