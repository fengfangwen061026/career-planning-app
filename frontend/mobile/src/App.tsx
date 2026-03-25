import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'

import { MobileAppProvider, useMobileApp } from './context/MobileAppContext'
import ChatFillPage from './pages/ChatFillPage'
import ExplorePage from './pages/ExplorePage'
import MatchDetailPage from './pages/MatchDetailPage'
import OnboardingFlow from './pages/OnboardingFlow'
import ParsingPage from './pages/ParsingPage'
import ProfilePage from './pages/ProfilePage'
import ReportPage from './pages/ReportPage'
import UploadPage from './pages/UploadPage'

function AppRoutes() {
  const { currentStudent, hasProfile, isHydrated, isLoadingProfile, profileFetchError, profile, clearSession, restoreStudentProfile } = useMobileApp()
  const navigate = useNavigate()

  if (!isHydrated) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'linear-gradient(180deg, #f5f7ff 0%, #ffffff 100%)',
          color: '#1f2937',
          fontSize: 14,
        }}
      >
        正在恢复学生会话...
      </div>
    )
  }

  if (currentStudent && hasProfile && isLoadingProfile && !profile) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'linear-gradient(180deg, #f5f7ff 0%, #ffffff 100%)',
          color: '#1f2937',
          fontSize: 14,
        }}
      >
        正在恢复学生画像...
      </div>
    )
  }

  // Profile fetch failed — show retry/switch UI instead of blank page
  if (currentStudent && hasProfile && !profile && !isLoadingProfile && profileFetchError) {
    return (
      <div
        style={{
          minHeight: '100vh',
          padding: '32px 20px',
          display: 'grid',
          placeItems: 'center',
          background: 'linear-gradient(180deg, #f5f7ff 0%, #ffffff 100%)',
        }}
      >
        <div
          style={{
            maxWidth: 360,
            borderRadius: 24,
            padding: 24,
            background: '#ffffff',
            boxShadow: '0 12px 32px rgba(15,23,42,0.08)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0A0A0A', marginBottom: 10 }}>
            画像加载失败
          </div>
          <p style={{ color: '#374151', fontSize: 13, lineHeight: 1.7, marginBottom: 18 }}>
            无法加载学生画像，可能是网络问题或服务暂时不可用。
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            <button
              type="button"
              onClick={() => void restoreStudentProfile()}
              style={{
                border: 'none',
                borderRadius: 14,
                padding: '12px 16px',
                background: '#1d4ed8',
                color: '#ffffff',
                fontWeight: 700,
              }}
            >
              重试
            </button>
            <button
              type="button"
              onClick={() => {
                clearSession()
                navigate('/onboarding', { replace: true })
              }}
              style={{
                borderRadius: 14,
                padding: '12px 16px',
                background: '#ffffff',
                color: '#334155',
                border: '1px solid #cbd5e1',
                fontWeight: 700,
              }}
            >
              切换账号
            </button>
          </div>
        </div>
      </div>
    )
  }

  const protectedElement = (element: JSX.Element) => {
    if (!currentStudent) {
      return <Navigate to="/onboarding" replace />
    }
    return element
  }

  const defaultRoute = currentStudent ? (hasProfile ? '/profile' : '/upload') : '/onboarding'

  return (
    <Routes>
      <Route path="/" element={<Navigate to={defaultRoute} replace />} />
      <Route path="/onboarding" element={<OnboardingFlow />} />
      <Route path="/upload" element={protectedElement(<UploadPage />)} />
      <Route path="/parsing" element={protectedElement(<ParsingPage />)} />
      <Route path="/profile" element={protectedElement(<ProfilePage />)} />
      <Route path="/chat-fill" element={protectedElement(<ChatFillPage />)} />
      <Route path="/explore" element={protectedElement(<ExplorePage />)} />
      <Route path="/match/:matchId" element={protectedElement(<MatchDetailPage />)} />
      <Route path="/report" element={protectedElement(<ReportPage />)} />
      <Route path="*" element={<Navigate to={defaultRoute} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <MobileAppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </MobileAppProvider>
  )
}
