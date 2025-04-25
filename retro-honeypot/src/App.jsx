import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import FakeAdmin from "./pages/FakeAdmin";
import FakeTerminal from "./components/FakeTerminal";

function App() {
  const [logs, setLogs] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:3001");

    socket.onopen = () => {
      console.log("Connected to WebSocket server");
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event === "new_log") {
        setLogs((prevLogs) => [data, ...prevLogs]);
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      socket.close();
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login setIsAuthenticated={setIsAuthenticated} />} />
        <Route path="/admin" element={<FakeAdmin />} />
        <Route path="/terminal" element={<FakeTerminal setIsAuthenticated={setIsAuthenticated} />} />
        <Route path="/dashboard" element={<Dashboard logs={logs} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
