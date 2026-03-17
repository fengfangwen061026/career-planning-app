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
import ResumeUploadPage from '../pages/ResumeUpload';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
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
        element: <ResumeUploadPage />,
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
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export default router;
