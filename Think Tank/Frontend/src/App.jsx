import { Navigate, Route, Routes } from 'react-router-dom';
import DashboardLayout from './components/layout/DashboardLayout';
import IdeaForm from './components/ideas/IdeaForm';
import Dashboard from './pages/Dashboard';
import Ideas from './pages/Ideas';
import IdeaDetail from './pages/IdeaDetail';
import Tasks from './pages/Tasks';
import Team from './pages/Team';
import ThinkLog from './pages/ThinkLog';
import Notifications from './pages/Notifications';
import Login from './pages/Login';
import { AppProvider } from './store/AppContext';
import { useAuth } from './store/AuthContext';

/** Everything inside the shell needs a signed-in user.
    `ready` is false until GET /api/auth/me answers — without it a refresh
    would bounce a signed-in user to /login for a frame. */
function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="boot-splash">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/** Opening a new idea is the chairman's. A team member who lands on the URL
    is sent to the ideas list rather than shown a form that would be refused
    by the API anyway. */
function ChairOnly({ children }) {
  const { isChair } = useAuth();
  if (!isChair) return <Navigate to="/ideas" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <AppProvider>
              <DashboardLayout />
            </AppProvider>
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="/ideas" element={<Ideas />} />
        <Route path="/ideas/new" element={<ChairOnly><IdeaForm /></ChairOnly>} />
        <Route path="/ideas/:id" element={<IdeaDetail />} />
        <Route path="/ideas/:id/edit" element={<IdeaForm />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/team" element={<Team />} />
        <Route path="/think-log" element={<ThinkLog />} />
        <Route path="/notifications" element={<Notifications />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
