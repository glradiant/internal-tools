import { Routes, Route } from 'react-router-dom';
import AuthGuard from './components/AuthGuard';
import HomePage from './pages/HomePage';
import LayoutCanvas from './pages/LayoutCanvas';
import ResetPasswordPage from './pages/ResetPasswordPage';
import CalibratePage from './pages/CalibratePage';

export default function App() {
  return (
    <Routes>
      {/* Reset password route - outside AuthGuard since user clicks link from email */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* All other routes require authentication */}
      <Route
        path="/*"
        element={
          <AuthGuard>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/layout/:id" element={<LayoutCanvas />} />
              <Route path="/calibrate" element={<CalibratePage />} />
            </Routes>
          </AuthGuard>
        }
      />
    </Routes>
  );
}
