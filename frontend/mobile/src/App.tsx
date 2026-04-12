import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './styles/tokens.css'

import OnboardingPage from './pages/Onboarding/OnboardingPage'
import UploadPage     from './pages/Upload/UploadPage'
import ParsingPage    from './pages/Parsing/ParsingPage'
import ProfilePage    from './pages/Profile/ProfilePage'
import ChatFillPage   from './pages/ChatFill/ChatFillPage'
import ExplorePage    from './pages/Explore/ExplorePage'
import MatchPage      from './pages/Match/MatchPage'
import ReportPage     from './pages/Report/ReportPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="page-root">
        <Routes>
          <Route path="/"           element={<Navigate to="/onboarding" replace />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/upload"     element={<UploadPage />} />
          <Route path="/parsing"    element={<ParsingPage />} />
          <Route path="/profile"    element={<ProfilePage />} />
          <Route path="/chat-fill"  element={<ChatFillPage />} />
          <Route path="/explore"    element={<ExplorePage />} />
          <Route path="/match/:id"  element={<MatchPage />} />
          <Route path="/report"     element={<ReportPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
