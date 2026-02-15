import { type ReactElement, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { CallProvider } from './context/CallContext';
import { useThemeStore } from './store/themeStore';

// Lazy load components
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ChatPage = lazy(() => import('./features/chat/ChatPage').then(module => ({ default: module.ChatPage })));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

const ProtectedRoute = ({ children }: { children: ReactElement }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  if (!user) return <Navigate to="/login" />;

  return (
    <ChatProvider>
      <CallProvider>
        {children}
      </CallProvider>
    </ChatProvider>
  );
};

function App() {
  const { isDarkMode } = useThemeStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  return (
    <>
      <Toaster position="top-right" />
      <Suspense fallback={<div className="h-screen flex items-center justify-center">Loading...</div>}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          {/* Catch all - 404 */}
          <Route path="*" element={<Suspense fallback={null}><NotFound /></Suspense>} />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;

