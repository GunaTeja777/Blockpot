import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const Login = ({ setIsAuthenticated }) => {
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === "adminaccess") {
      setIsAuthenticated(true);
      navigate("/terminal");
    } else {
      alert("Incorrect password. Try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <form onSubmit={handleLogin} className="bg-gray-800 p-8 rounded shadow-md space-y-4 w-96">
        <h1 className="text-2xl font-bold text-center">Old Admin Login</h1>
        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 rounded bg-gray-700 text-white"
        />
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-800 py-2 rounded text-white"
        >
          Login
        </button>
      </form>
    </div>
  );
};

export default Login;
