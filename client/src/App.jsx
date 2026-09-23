import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, roleHome } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import MotherDashboard from './pages/MotherDashboard.jsx';
import DoctorDashboard from './pages/DoctorDashboard.jsx';
import HealthUnitDashboard from './pages/HealthUnitDashboard.jsx';
import Loader from './components/Loader.jsx';

function Protected({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader full />;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={roleHome(user.role)} replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/" element={<Navigate to={user ? roleHome(user.role) : '/login'} replace />} />
      <Route path="/login" element={user ? <Navigate to={roleHome(user.role)} replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to={roleHome(user.role)} replace /> : <Register />} />
      <Route
        path="/mother"
        element={
          <Protected role="mother">
            <MotherDashboard />
          </Protected>
        }
      />
      <Route
        path="/doctor"
        element={
          <Protected role="doctor">
            <DoctorDashboard />
          </Protected>
        }
      />
      <Route
        path="/unit"
        element={
          <Protected role="health_unit">
            <HealthUnitDashboard />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
