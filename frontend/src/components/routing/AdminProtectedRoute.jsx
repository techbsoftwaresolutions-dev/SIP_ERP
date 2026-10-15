import { Navigate } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";
import Loader from "../ui/Loader";

// Gate for everything under /admin. Separate from the client ProtectedRoute:
// a signed-in client user has no standing here, and a signed-in super admin
// has none in the client app.
export default function AdminProtectedRoute({ children }) {
  const { isAuthenticated, checking } = useAdminAuth();

  // A stored token is re-validated against the server on mount; redirecting
  // before that finishes would bounce a perfectly good session to the login
  // screen on every refresh.
  if (checking) {
    return (
      <div className="loading-row" style={{ padding: 64, textAlign: "center" }}>
        <Loader />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;

  return children;
}
