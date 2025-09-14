import { Navigate, useLocation } from 'react-router-dom';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const location = useLocation();

  return token
    ? children
    : <Navigate to={`/sign-in?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
};

export default PrivateRoute;