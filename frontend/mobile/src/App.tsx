import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import OnboardingFlow from './pages/OnboardingFlow'
import UploadPage from './pages/UploadPage'
import ParsingPage from './pages/ParsingPage'
import ProfilePage from './pages/ProfilePage'
import ChatFillPage from './pages/ChatFillPage'
import ExplorePage from './pages/ExplorePage'
import MatchDetailPage from './pages/MatchDetailPage'
import ReportPage from './pages/ReportPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/onboarding" replace />} />
        <Route path="/onboarding" element={<OnboardingFlow />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/parsing" element={<ParsingPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/chat-fill" element={<ChatFillPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/match/:jobId" element={<MatchDetailPage />} />
        <Route path="/report" element={<ReportPage />} />
      </Routes>
    </BrowserRouter>
  )
}
