import client from './client';
import type {
  JobResponse,
  JobCreate,
  JobUpdate,
  JobProfileResponse,
  JobProfileCreate,
  JobProfileUpdate,
  PaginatedJobResponse,
  RoleResponse,
  JobProfileHistoryResponse,
  PaginatedRoleCompaniesResponse,
  SalaryDistributionItem,
  CityDistributionItem,
  BenefitItem,
  CompanyResponse,
} from '../types/job';

export interface JobsParams {
  page?: number;
  page_size?: number;
  role?: string;
  keyword?: string;
}

export const jobsApi = {
  // Job CRUD
  getJobs: (params?: JobsParams) =>
    client.get<PaginatedJobResponse>('/jobs/', { params }),

  getJob: (id: string) =>
    client.get<JobResponse>(`/jobs/${id}`),

  createJob: (data: JobCreate) =>
    client.post<JobResponse>('/jobs/', data),

  updateJob: (id: string, data: JobUpdate) =>
    client.patch<JobResponse>(`/jobs/${id}`, data),

  deleteJob: (id: string) =>
    client.delete(`/jobs/${id}`),

  // Roles
  getRoles: (include_stats?: boolean) =>
    client.get<RoleResponse[]>('/roles/', { params: { include_stats } }),

  // Job Profile
  getJobProfile: (id: string) =>
    client.get<JobProfileResponse>(`/jobs/${id}/profile`),

  createJobProfile: (id: string, data: Partial<JobProfileCreate>) =>
    client.post<JobProfileResponse>(`/jobs/${id}/profile`, data),

  // Role-based Job Profiles
  getRoleProfiles: (roleId: string) =>
    client.get<JobProfileHistoryResponse>(`/job-profiles/${roleId}`),

  updateJobProfile: (profileId: string, data: JobProfileUpdate) =>
    client.put<JobProfileResponse>(`/job-profiles/${profileId}`, data),

  // Batch operations
  importJobs: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return client.post<JobResponse[]>('/jobs/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Role-Company 关联 API
  getRoleCompanies: (roleId: string, params?: {
    page?: number;
    page_size?: number;
    sort_by?: string;
    industry?: string;
    company_size?: string;
  }) => client.get<PaginatedRoleCompaniesResponse>(`/roles/${roleId}/companies`, { params }),

  getSalaryDistribution: (roleId: string) =>
    client.get<SalaryDistributionItem[]>(`/roles/${roleId}/salary-distribution`),

  getCityDistribution: (roleId: string, limit?: number) =>
    client.get<CityDistributionItem[]>(`/roles/${roleId}/city-distribution`, { params: { limit } }),

  getBenefitsStats: (roleId: string) =>
    client.get<BenefitItem[]>(`/roles/${roleId}/benefits-stats`),

  getCompany: (companyId: string) =>
    client.get<CompanyResponse>(`/companies/${companyId}`),

  listCompanies: (params?: {
    page?: number;
    page_size?: number;
    industry?: string;
  }) => client.get<{ items: CompanyResponse[]; total: number; page: number; page_size: number; total_pages: number }>('/companies', { params }),
};
