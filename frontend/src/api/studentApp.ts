import client from './client';
import type {
  CareerPathResponse,
  ProfileCompletionApplyRequest,
  ProfileCompletionApplyResponse,
  ProfileCompletionSessionResponse,
  StudentRecommendationResponse,
  StudentSessionRequest,
  StudentSessionResponse,
} from '../types/studentApp';

export const studentAppApi = {
  createSession: (data: StudentSessionRequest) =>
    client.post<StudentSessionResponse>('/student-app/session', data),

  getRecommendations: (studentId: string, params?: { top_k?: number; role_category?: string }) =>
    client.get<StudentRecommendationResponse>(`/student-app/students/${studentId}/recommendations`, {
      params,
    }),

  getCareerPath: (studentId: string, jobProfileId: string) =>
    client.get<CareerPathResponse>(`/student-app/students/${studentId}/career-path`, {
      params: { job_profile_id: jobProfileId },
    }),

  createProfileCompletionSession: (studentId: string) =>
    client.post<ProfileCompletionSessionResponse>(`/student-app/students/${studentId}/profile-completion/session`),

  applyProfileCompletion: (studentId: string, data: ProfileCompletionApplyRequest) =>
    client.post<ProfileCompletionApplyResponse>(
      `/student-app/students/${studentId}/profile-completion/apply`,
      data,
    ),
};
