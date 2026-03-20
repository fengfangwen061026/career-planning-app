import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

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
  const { currentStudent, hasProfile, isHydrated, isLoadingProfile, profile } = useMobileApp()

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
