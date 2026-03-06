import client from './client';
import type {
  MatchingRequest,
  MatchingResponse,
  MatchResultResponse,
  RecommendRequest,
} from '../types/matching';

export const matchingApi = {
  // Run matching for a specific student + job profile
  runMatch: (data: MatchingRequest) =>
    client.post<MatchResultResponse>('/matching/match', data),

  // Recommend top-N jobs for a student
  recommendJobs: (studentId: string, request?: RecommendRequest) =>
    client.post<MatchingResponse>(`/matching/recommend/${studentId}`, request || { top_k: 10 }),

  // Get matching results for a student
  getMatchingResults: (studentId: string) =>
    client.get<MatchingResponse>(`/matching/student/${studentId}`),

  // Get specific match result
  getMatchResult: (id: string) =>
    client.get<MatchResultResponse>(`/matching/result/${id}`),
};
