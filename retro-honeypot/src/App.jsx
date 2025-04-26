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
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Initialize WebSocket connection and authentication
  useEffect(() => {
    let isMounted = true;

    const initializeApp = async () => {
      try {
        // Check authentication status first
        const authStatus = await checkAuthStatus();
        if (isMounted) {
          setIsAuthenticated(authStatus);
          if (!authStatus) {
            navigate("/login");
          }
        }

        // Initialize WebSocket connection
        webSocketService.connect();

        // Setup WebSocket listeners
        const removeLogListener = webSocketService.addListener(
          "new_log",
          (newLog) => {
            if (isMounted) {
              setLogs((prevLogs) => [newLog.data, ...prevLogs.slice(0, 99)]);
            }
          }
        );

        const removeStatusListener = webSocketService.addListener(
          "connection_change",
          (status) => {
            if (isMounted) {
              setConnectionStatus(status);
              if (status === "disconnected") {
                setError("WebSocket disconnected - attempting to reconnect...");
              } else if (status === "connected") {
                setError(null);
              }
            }
          }
        );

        const removeErrorListener = webSocketService.addListener(
          "error",
          (wsError) => {
            if (isMounted) {
              setError(`WebSocket error: ${wsError.message || wsError.toString()}`);
            }
          }
        );

        return () => {
          removeLogListener();
          removeStatusListener();
          removeErrorListener();
        };
      } catch (err) {
        if (isMounted) {
          console.error("Initialization error:", err);
          setError("Failed to initialize application");
          setIsAuthenticated(false);
          navigate("/login");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeApp();

    return () => {
      isMounted = false;
      webSocketService.disconnect();
    };
  }, [navigate]);

  const ProtectedRoute = ({ element: Element, ...rest }) => {
    if (loading) {
      return <div className="flex justify-center items-center h-screen">Loading...</div>;
    }

    if (!isAuthenticated) {
      return <Login setIsAuthenticated={setIsAuthenticated} setError={setError} />;
    }

    return <Element {...rest} />;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl">Initializing application...</div>
      </div>
    );
  }

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
          path="/login"
          element={
            <Login setIsAuthenticated={setIsAuthenticated} setError={setError} />
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute element={Dashboard} logs={logs} />
          }
        />
        <Route
          path="/dashboard"
          element={<ProtectedRoute element={Dashboard} logs={logs} />}
        />
        <Route 
          path="/admin" 
          element={<ProtectedRoute element={FakeAdmin} />} 
        />
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