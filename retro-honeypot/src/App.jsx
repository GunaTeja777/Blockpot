import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import FakeAdmin from "./pages/FakeAdmin";
import FakeTerminal from "./components/FakeTerminal";
import { checkAuthStatus } from "./services/auth";
import { webSocketService } from "./services/websocket";

function App() {
  const [logs, setLogs] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Verify authentication status
    const verifyAuth = async () => {
      try {
        const authStatus = await checkAuthStatus();
        setIsAuthenticated(authStatus);
        if (!authStatus) {
          navigate("/");
        }
      } catch (err) {
        console.error("Auth verification failed:", err);
        setError("Failed to verify authentication status");
      }
    };

    verifyAuth();

    // Initialize WebSocket connection
    webSocketService.connect();

    const removeLogListener = webSocketService.addListener(
      "new_log",
      (newLog) => {
        setLogs((prevLogs) => [newLog, ...prevLogs.slice(0, 99)]);
      }
    );

    const removeStatusListener = webSocketService.addListener(
      "connection_change",
      (status) => {
        setConnectionStatus(status);
        if (status === "disconnected") {
          setError("WebSocket disconnected - attempting to reconnect...");
        } else if (status === "connected") {
          setError(null);
        }
      }
    );

    const removeErrorListener = webSocketService.addListener(
      "error",
      (error) => {
        setError(`WebSocket error: ${error.message}`);
      }
    );

    return () => {
      removeLogListener();
      removeStatusListener();
      removeErrorListener();
      // Don't disconnect here - let the service manage reconnections
    };
  }, [navigate]);

  const ProtectedRoute = ({ element: Element, ...rest }) => {
    if (!isAuthenticated) {
      return <Login setIsAuthenticated={setIsAuthenticated} setError={setError} />;
    }
    return <Element {...rest} />;
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-200">
      {/* Connection status indicator */}
      <div
        className={`fixed top-3 right-3 px-3 py-1 rounded-md text-xs font-medium ${
          connectionStatus === "connected"
            ? "bg-green-500 text-white"
            : "bg-red-500 text-white"
        } z-50`}
      >
        {connectionStatus === "connected" ? (
          <span>Connected</span>
        ) : (
          <span>Disconnected</span>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="fixed top-0 left-0 right-0 bg-red-500 text-white p-3 text-center z-50 flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-4 border border-white px-2 py-1 rounded text-xs hover:bg-red-600 transition"
          >
            Dismiss
          </button>
        </div>
      )}

      <Routes>
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Dashboard logs={logs} />
            ) : (
              <Login setIsAuthenticated={setIsAuthenticated} setError={setError} />
            )
          }
        />
        <Route
          path="/dashboard"
          element={<ProtectedRoute element={Dashboard} logs={logs} />}
        />
        <Route path="/admin" element={<FakeAdmin />} />
        <Route
          path="/terminal"
          element={
            <ProtectedRoute
              element={FakeTerminal}
              setIsAuthenticated={setIsAuthenticated}
              setError={setError}
            />
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

function AppWrapper() {
  return (
    <Router>
      <App />
    </Router>
  );
}

export default AppWrapper;