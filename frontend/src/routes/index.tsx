import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Dashboard from './Dashboard';
import JobManagement from './JobManagement';
import JobProfiles from './JobProfiles';
import JobProfileDetail from './JobProfileDetail';
import JobGraph from './JobGraph';
import ResumeUpload from './ResumeUpload';
import StudentProfile from './StudentProfile';
import Matching from './Matching';
import Report from './Report';
import Login, { isAdminAuthenticated } from './Login';

function RequireAdminAuth({ children }: { children: ReactNode }) {
  return isAdminAuthenticated() ? children : <Navigate to="/login" replace />;
}

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: (
        <RequireAdminAuth>
          <Layout />
        </RequireAdminAuth>
      ),
      children: [
        {
          index: true,
          element: <Dashboard />,
        },
        {
          path: 'jobs',
          element: <JobManagement />,
        },
        {
          path: 'jobs/profiles',
          element: <JobProfiles />,
        },
        {
          path: 'jobs/profiles/:roleId',
          element: <JobProfileDetail />,
        },
        {
          path: 'jobs/graph',
          element: <JobGraph />,
        },
        {
          path: 'resume',
          element: <ResumeUpload />,
        },
        {
          path: 'resume-upload',
          element: <Navigate to="/resume" replace />,
        },
        {
          path: 'students',
          element: <StudentProfile />,
        },
        {
          path: 'students/:studentId',
          element: <StudentProfile />,
        },
        {
          path: 'matching',
          element: <Matching />,
        },
        {
          path: 'reports',
          element: <Report />,
        },
      ],
    },
    {
      path: 'login',
      element: <Login />,
    },
    {
      path: '*',
      element: <Navigate to="/" replace />,
    },
  ],
  {
    basename: '/admin',
  }
);

export default router;
