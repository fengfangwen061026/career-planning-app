const SESSION_KEY = 'career_student_id'
const SESSION_NAME_KEY = 'career_student_name'
const SESSION_EMAIL_KEY = 'career_student_email'
const SESSION_REPORT_KEY = 'career_report_id'
const SESSION_RESUME_KEY = 'career_resume_id'
const SESSION_PROFILE_KEY = 'career_has_profile'
const SESSION_TARGET_JOB_KEY = 'career_target_job_profile_id'

export const session = {
  getStudentId(): string | null {
    return localStorage.getItem(SESSION_KEY)
  },
  setStudentId(id: string): void {
    localStorage.setItem(SESSION_KEY, id)
  },
  getName(): string {
    return localStorage.getItem(SESSION_NAME_KEY) || '同学'
  },
  setName(name: string): void {
    localStorage.setItem(SESSION_NAME_KEY, name)
  },
  getEmail(): string | null {
    return localStorage.getItem(SESSION_EMAIL_KEY)
  },
  setEmail(email: string): void {
    localStorage.setItem(SESSION_EMAIL_KEY, email)
  },
  getReportId(): string | null {
    return localStorage.getItem(SESSION_REPORT_KEY)
  },
  setReportId(id: string): void {
    localStorage.setItem(SESSION_REPORT_KEY, id)
  },
  getResumeId(): string | null {
    return localStorage.getItem(SESSION_RESUME_KEY)
  },
  setResumeId(id: string): void {
    localStorage.setItem(SESSION_RESUME_KEY, id)
  },
  hasProfile(): boolean {
    return localStorage.getItem(SESSION_PROFILE_KEY) === 'true'
  },
  setHasProfile(v: boolean): void {
    localStorage.setItem(SESSION_PROFILE_KEY, v ? 'true' : 'false')
  },
  getTargetJobProfileId(): string | null {
    return localStorage.getItem(SESSION_TARGET_JOB_KEY)
  },
  setTargetJobProfileId(id: string): void {
    localStorage.setItem(SESSION_TARGET_JOB_KEY, id)
  },
  clear(): void {
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(SESSION_NAME_KEY)
    localStorage.removeItem(SESSION_EMAIL_KEY)
    localStorage.removeItem(SESSION_REPORT_KEY)
    localStorage.removeItem(SESSION_RESUME_KEY)
    localStorage.removeItem(SESSION_PROFILE_KEY)
    localStorage.removeItem(SESSION_TARGET_JOB_KEY)
  },
  DEMO_STUDENT_ID: '00000000-0000-0000-0000-000000009001',
  DEMO_EMAIL: 'demo@career.ai',
  DEMO_NAME: '张明',
}
