import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import axios from 'axios'

import { reportsApi } from '@shared/api/reports'
import { matchingApi } from '@shared/api/matching'
import { studentApi } from '@shared/api/student'
import { studentAppApi } from '@shared/api/studentApp'
import { studentsApi } from '@shared/api/students'
import type { MatchResultResponse } from '@shared/types/matching'
import type { CareerReportResponse } from '@shared/types/report'
import type { StudentProfileResponse, StudentResponse, ResumeResponse } from '@shared/types/student'
import type {
  ProfileCompletionApplyRequest,
  ProfileCompletionSessionResponse,
  StudentRecommendationItem,
  StudentSessionRequest,
} from '@shared/types/studentApp'

type UploadStatus = 'idle' | 'uploading' | 'completed' | 'error'

export interface UploadState {
  status: UploadStatus
  progress: number
  stage: string
  message: string
  fileName?: string
  error?: string
  isFallback: boolean
  retrying: boolean
}

interface BootstrapResult {
  student: StudentResponse
  hasProfile: boolean
}

interface SessionStorageValue {
  student: StudentResponse
  hasProfile: boolean
}

interface MobileAppContextValue {
  isHydrated: boolean
  currentStudent: StudentResponse | null
  hasProfile: boolean
  profile: StudentProfileResponse | null
  lastResume: ResumeResponse | null
  uploadState: UploadState
  recommendations: StudentRecommendationItem[]
  selectedRecommendation: StudentRecommendationItem | null
  reports: CareerReportResponse[]
  currentReport: CareerReportResponse | null
  completionSession: ProfileCompletionSessionResponse | null
  isLoadingProfile: boolean
  isLoadingRecommendations: boolean
  isLoadingReports: boolean
  bootstrapSession: (payload: StudentSessionRequest) => Promise<BootstrapResult>
  restoreStudentProfile: () => Promise<StudentProfileResponse | null>
  startResumeUpload: (file: File) => Promise<StudentProfileResponse>
  resetUploadState: () => void
  refreshRecommendations: (params?: { top_k?: number; role_category?: string; force?: boolean }) => Promise<StudentRecommendationItem[]>
  selectRecommendation: (recommendation: StudentRecommendationItem | null) => void
  getMatchResultById: (matchId: string) => Promise<MatchResultResponse>
  refreshReports: () => Promise<CareerReportResponse[]>
  generateReport: (jobProfileIds?: string[]) => Promise<CareerReportResponse>
  loadCompletionSession: () => Promise<ProfileCompletionSessionResponse | null>
  applyCompletionAnswers: (payload: ProfileCompletionApplyRequest) => Promise<StudentProfileResponse>
  clearSession: () => void
}

const SESSION_STORAGE_KEY = 'student-mobile-session'

const defaultUploadState: UploadState = {
  status: 'idle',
  progress: 0,
  stage: 'idle',
  message: '上传简历后会在这里展示真实解析进度',
  isFallback: false,
  retrying: false,
}

const stageMessages: Record<string, string> = {
  queued: '正在准备上传',
  extracting: '正在提取简历文本',
  parsing: '正在进行 AI 解析',
  retrying: 'AI 解析失败，正在自动重试',
  generating_profile: '解析完成，正在生成学生画像',
  complete: '画像已生成完成',
}

const MobileAppContext = createContext<MobileAppContextValue | undefined>(undefined)

function isAxiosNotFound(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404
}

function normalizeErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data as { detail?: string } | undefined
    return detail?.detail || error.message || fallback
  }
  if (error instanceof Error) {
    return error.message || fallback
  }
  return fallback
}

function mergeReports(nextReport: CareerReportResponse, existing: CareerReportResponse[]): CareerReportResponse[] {
  const remaining = existing.filter((report) => report.id !== nextReport.id)
  return [nextReport, ...remaining].sort((left, right) => {
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  })
}

export function MobileAppProvider({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false)
  const [currentStudent, setCurrentStudent] = useState<StudentResponse | null>(null)
  const [hasProfile, setHasProfile] = useState(false)
  const [profile, setProfile] = useState<StudentProfileResponse | null>(null)
  const [lastResume, setLastResume] = useState<ResumeResponse | null>(null)
  const [uploadState, setUploadState] = useState<UploadState>(defaultUploadState)
  const [recommendations, setRecommendations] = useState<StudentRecommendationItem[]>([])
  const [selectedRecommendation, setSelectedRecommendation] = useState<StudentRecommendationItem | null>(null)
  const [reports, setReports] = useState<CareerReportResponse[]>([])
  const [currentReport, setCurrentReport] = useState<CareerReportResponse | null>(null)
  const [completionSession, setCompletionSession] = useState<ProfileCompletionSessionResponse | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false)
  const [isLoadingReports, setIsLoadingReports] = useState(false)
  const recommendationRequestRef = useRef<{
    key: string | null
    promise: Promise<StudentRecommendationItem[]> | null
  }>({
    key: null,
    promise: null,
  })

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as SessionStorageValue | StudentResponse
        if ('student' in parsed) {
          setCurrentStudent(parsed.student)
          setHasProfile(Boolean(parsed.hasProfile))
        } else {
          setCurrentStudent(parsed)
          setHasProfile(false)
        }
      } catch {
        localStorage.removeItem(SESSION_STORAGE_KEY)
      }
    }
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (!isHydrated || !currentStudent) {
      return
    }
    if (hasProfile) {
      if (!profile && !isLoadingProfile) {
        void restoreStudentProfile()
      }
    } else {
      setProfile(null)
      setReports([])
      setCurrentReport(null)
    }
  }, [currentStudent?.id, hasProfile, isHydrated, isLoadingProfile, profile])

  function persistSession(student: StudentResponse, nextHasProfile: boolean) {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      student,
      hasProfile: nextHasProfile,
    } satisfies SessionStorageValue))
  }

  function clearRecommendationRequest() {
    recommendationRequestRef.current = {
      key: null,
      promise: null,
    }
  }

  function buildRecommendationRequestKey(studentId: string, params?: {
    top_k?: number
    role_category?: string
  }) {
    const topK = params?.top_k ?? 10
    const roleCategory = params?.role_category || '__all__'
    return `${studentId}:${topK}:${roleCategory}`
  }

  async function restoreStudentProfile(): Promise<StudentProfileResponse | null> {
    if (!currentStudent) {
      setProfile(null)
      return null
    }

    setIsLoadingProfile(true)
    try {
      const response = await studentsApi.getStudentProfile(currentStudent.id)
      setProfile(response.data)
      return response.data
    } catch (error) {
      if (isAxiosNotFound(error)) {
        setHasProfile(false)
        persistSession(currentStudent, false)
        setProfile(null)
        return null
      }
      throw error
    } finally {
      setIsLoadingProfile(false)
    }
  }

  async function bootstrapSession(payload: StudentSessionRequest): Promise<BootstrapResult> {
    const response = await studentAppApi.createSession(payload)
    const student = response.data.student
    const nextHasProfile = Boolean(response.data.has_profile)
    setCurrentStudent(student)
    setHasProfile(nextHasProfile)
    persistSession(student, nextHasProfile)
    setRecommendations([])
    setSelectedRecommendation(null)
    setReports([])
    setCurrentReport(null)
    setCompletionSession(null)
    setLastResume(null)
    setUploadState(defaultUploadState)
    clearRecommendationRequest()

    let restoredProfile: StudentProfileResponse | null = null
    if (nextHasProfile) {
      try {
        const profileResponse = await studentsApi.getStudentProfile(student.id)
        restoredProfile = profileResponse.data
        setProfile(restoredProfile)
      } catch (error) {
        if (!isAxiosNotFound(error)) {
          throw error
        }
        setHasProfile(false)
        persistSession(student, false)
        setProfile(null)
      }
    } else {
      setProfile(null)
    }

    return {
      student,
      hasProfile: Boolean(restoredProfile),
    }
  }

  function resetUploadState() {
    setUploadState(defaultUploadState)
  }

  async function parseStream(response: Response): Promise<Record<string, unknown>> {
    if (!response.body) {
      throw new Error('上传流未返回可读取的数据')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let completedPayload: Record<string, unknown> | null = null

    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done })

      const events = buffer.split('\n\n')
      buffer = events.pop() || ''

      for (const event of events) {
        const dataLines = event
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())

        if (!dataLines.length) {
          continue
        }

        const payload = JSON.parse(dataLines.join('\n')) as Record<string, unknown>
        const type = String(payload.type || '')

        if (type === 'stage') {
          const stage = String(payload.stage || 'parsing')
          setUploadState((previous) => ({
            ...previous,
            status: 'uploading',
            stage,
            progress: Number(payload.progress || previous.progress || 0),
            message: stageMessages[stage] || `正在执行 ${stage}`,
          }))
        }

        if (type === 'fallback') {
          const data = (payload.data || {}) as Record<string, unknown>
          const parseMeta = (data.parse_meta || {}) as Record<string, unknown>
          setUploadState((previous) => ({
            ...previous,
            status: 'uploading',
            stage: 'retrying',
            progress: Number(payload.progress || previous.progress || 72),
            message: String(payload.message || 'AI 解析失败，已切换为兜底结果并自动重试'),
            isFallback: Boolean(parseMeta.is_fallback ?? true),
            retrying: true,
          }))
        }

        if (type === 'retrying') {
          setUploadState((previous) => ({
            ...previous,
            status: 'uploading',
            stage: 'retrying',
            progress: Number(payload.progress || previous.progress || 84),
            message: String(payload.message || '正在重试 AI 解析'),
            retrying: true,
          }))
        }

        if (type === 'complete') {
          completedPayload = (payload.data || {}) as Record<string, unknown>
          const parseMeta = ((completedPayload.parse_meta || {}) as Record<string, unknown>)
          setUploadState((previous) => ({
            ...previous,
            status: 'uploading',
            stage: 'generating_profile',
            progress: 100,
            message: '简历解析完成，正在生成学生画像',
            isFallback: Boolean(parseMeta.is_fallback ?? previous.isFallback),
            retrying: false,
          }))
        }

        if (type === 'error') {
          const message = String(payload.message || '简历解析失败')
          setUploadState({
            status: 'error',
            progress: 0,
            stage: 'error',
            message,
            error: message,
            isFallback: false,
            retrying: false,
          })
          throw new Error(message)
        }
      }

      if (done) {
        break
      }
    }

    if (!completedPayload) {
      throw new Error('上传流未返回完成事件')
    }

    return completedPayload
  }

  async function startResumeUpload(file: File): Promise<StudentProfileResponse> {
    if (!currentStudent) {
      throw new Error('请先登录学生会话')
    }

    setUploadState({
      status: 'uploading',
      progress: 5,
      stage: 'queued',
      message: stageMessages.queued,
      fileName: file.name,
      isFallback: false,
      retrying: false,
    })

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/students/${currentStudent.id}/upload-resume/stream`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || '上传失败')
      }

      const completedPayload = await parseStream(response)
      const resume = completedPayload.resume as ResumeResponse
      setLastResume(resume)

      const profileResponse = await studentApi.generateProfile(currentStudent.id, {
        resume_id: resume.id,
      })

      setHasProfile(true)
      persistSession(currentStudent, true)
      setProfile(profileResponse.data)
      setRecommendations([])
      setSelectedRecommendation(null)
      setReports([])
      setCurrentReport(null)
      setCompletionSession(null)
      clearRecommendationRequest()
      setUploadState((previous) => ({
        ...previous,
        status: 'completed',
        stage: 'complete',
        message: previous.isFallback ? '已基于兜底解析结果完成画像生成' : stageMessages.complete,
        retrying: false,
      }))
      void refreshRecommendations({ top_k: 12 }).catch(() => {})

      return profileResponse.data
    } catch (error) {
      const message = normalizeErrorMessage(error, '简历上传失败，请稍后重试')
      setUploadState({
        status: 'error',
        progress: 0,
        stage: 'error',
        message,
        error: message,
        fileName: file.name,
        isFallback: false,
        retrying: false,
      })
      throw error
    }
  }

  async function refreshRecommendations(params?: {
    top_k?: number
    role_category?: string
    force?: boolean
  }): Promise<StudentRecommendationItem[]> {
    if (!currentStudent) {
      return []
    }

    const { force = false, ...requestParams } = params || {}
    const requestKey = buildRecommendationRequestKey(currentStudent.id, requestParams)

    if (!force && recommendationRequestRef.current.key === requestKey && recommendationRequestRef.current.promise) {
      return recommendationRequestRef.current.promise
    }

    const requestPromise = (async () => {
      setIsLoadingRecommendations(true)
      try {
        const response = await studentAppApi.getRecommendations(currentStudent.id, requestParams)
        setRecommendations(response.data.results)
        setSelectedRecommendation((previous) => {
          if (!previous) {
            return null
          }
          return response.data.results.find((item) => item.id === previous.id) || null
        })
        return response.data.results
      } finally {
        setIsLoadingRecommendations(false)
        if (recommendationRequestRef.current.key === requestKey) {
          clearRecommendationRequest()
        }
      }
    })()

    recommendationRequestRef.current = {
      key: requestKey,
      promise: requestPromise,
    }

    return requestPromise
  }

  function selectRecommendation(recommendation: StudentRecommendationItem | null) {
    setSelectedRecommendation(recommendation)
  }

  async function getMatchResultById(matchId: string): Promise<MatchResultResponse> {
    const response = await matchingApi.getMatchResult(matchId)
    return response.data
  }

  async function refreshReports(): Promise<CareerReportResponse[]> {
    if (!currentStudent) {
      setReports([])
      setCurrentReport(null)
      return []
    }

    setIsLoadingReports(true)
    try {
    const response = await reportsApi.getReports({ student_id: currentStudent.id, limit: 20 })
      setReports(response.data)
      setCurrentReport(response.data[0] || null)
      return response.data
    } finally {
      setIsLoadingReports(false)
    }
  }

  async function generateReport(jobProfileIds?: string[]): Promise<CareerReportResponse> {
    if (!currentStudent) {
      throw new Error('请先登录学生会话')
    }

    const response = await reportsApi.generateReport({
      student_id: currentStudent.id,
      include_export: false,
      job_profile_ids: jobProfileIds,
    })

    setReports((previous) => mergeReports(response.data, previous))
    setCurrentReport(response.data)
    return response.data
  }

  async function loadCompletionSession(): Promise<ProfileCompletionSessionResponse | null> {
    if (!currentStudent) {
      return null
    }
    const response = await studentAppApi.createProfileCompletionSession(currentStudent.id)
    setCompletionSession(response.data)
    return response.data
  }

  async function applyCompletionAnswers(payload: ProfileCompletionApplyRequest): Promise<StudentProfileResponse> {
    if (!currentStudent) {
      throw new Error('请先登录学生会话')
    }

    const response = await studentAppApi.applyProfileCompletion(currentStudent.id, payload)
    setHasProfile(true)
    persistSession(currentStudent, true)
    setProfile(response.data.profile)
    setRecommendations([])
    setSelectedRecommendation(null)
    setReports([])
    setCurrentReport(null)
    setCompletionSession(null)
    clearRecommendationRequest()
    void refreshRecommendations({ top_k: 12 }).catch(() => {})
    return response.data.profile
  }

  function clearSession() {
    localStorage.removeItem(SESSION_STORAGE_KEY)
    setCurrentStudent(null)
    setHasProfile(false)
    setProfile(null)
    setLastResume(null)
    setUploadState(defaultUploadState)
    setRecommendations([])
    setSelectedRecommendation(null)
    setReports([])
    setCurrentReport(null)
    setCompletionSession(null)
    clearRecommendationRequest()
  }

  const value: MobileAppContextValue = {
    isHydrated,
    currentStudent,
    hasProfile,
    profile,
    lastResume,
    uploadState,
    recommendations,
    selectedRecommendation,
    reports,
    currentReport,
    completionSession,
    isLoadingProfile,
    isLoadingRecommendations,
    isLoadingReports,
    bootstrapSession,
    restoreStudentProfile,
    startResumeUpload,
    resetUploadState,
    refreshRecommendations,
    selectRecommendation,
    getMatchResultById,
    refreshReports,
    generateReport,
    loadCompletionSession,
    applyCompletionAnswers,
    clearSession,
  }

  return <MobileAppContext.Provider value={value}>{children}</MobileAppContext.Provider>
}

export function useMobileApp() {
  const context = useContext(MobileAppContext)
  if (!context) {
    throw new Error('useMobileApp must be used inside MobileAppProvider')
  }
  return context
}
