import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const FakeTerminal = ({ setIsAuthenticated }) => {
  const [command, setCommand] = useState("");
  const navigate = useNavigate();

  const handleCommand = (e) => {
    e.preventDefault();
    if (command.trim() === "access_admin") {
      navigate("/admin");
    } else {
      alert("Unknown command. Try 'access_admin'");
    }
  };

  return (
    <div className="min-h-screen bg-black text-green-500 font-mono p-8">
      <h2 className="mb-4 text-lg">Remote CLI Access</h2>
      <p>Connect to internal SSH gateway to perform system-level tasks:</p>
      <form onSubmit={handleCommand}>
        <input
          className="w-full mt-4 p-2 bg-black border border-green-500 text-green-400"
          placeholder="Type your command..."
          value={command}
          onChange={(e) => setCommand(e.target.value)}
        />
      </form>
    </div>
  );
};

export default FakeTerminal;
