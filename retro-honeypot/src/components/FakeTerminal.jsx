import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const FakeTerminal = ({ setIsAuthenticated }) => {
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Initial terminal output
    setOutput([
      "Connected to legacy system (v2.4.1)",
      "Warning: This system is scheduled for decommissioning",
      "Type 'help' for available commands",
      ""
    ]);
  }, []);

  const handleCommand = async (e) => {
    e.preventDefault();
    if (!command.trim()) return;

    setIsProcessing(true);
    setOutput(prev => [...prev, `$ ${command}`]);
    
    try {
      // Simulate command processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (command.trim() === "access_admin") {
        setOutput(prev => [...prev, "Access granted. Redirecting to admin panel..."]);
        setTimeout(() => navigate("/admin"), 800);
      } else if (command.trim() === "help") {
        setOutput(prev => [...prev, 
          "Available commands:",
          "access_admin - Gain admin privileges",
          "scan_network - List connected devices",
          "show_logs - Display system logs",
          ""
        ]);
      } else if (command.trim() === "scan_network") {
        setOutput(prev => [...prev, 
          "Network scan results:",
          "192.168.1.1 - Router",
          "192.168.1.2 - Database Server",
          "192.168.1.3 - Backup Server",
          "192.168.1.100-150 - Client Devices",
          ""
        ]);
      } else if (command.trim() === "show_logs") {
        setOutput(prev => [...prev, 
          "System logs:",
          "2023-11-15 08:23: Failed login attempt (admin)",
          "2023-11-15 08:25: SSH connection from 192.168.1.15",
          "2023-11-15 08:30: Database backup initiated",
          ""
        ]);
      } else {
        setOutput(prev => [...prev, `Error: Unknown command '${command}'`, ""]);
      }
    } catch (err) {
      setOutput(prev => [...prev, "Error: Command failed to execute", ""]);
    } finally {
      setCommand("");
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-green-400 font-mono p-4 md:p-8 flex flex-col">
      <div className="mb-4">
        <h2 className="text-lg md:text-xl font-bold text-green-300">
          Remote CLI Access [Legacy System]
        </h2>
        <p className="text-green-500">
          Connect to internal SSH gateway to perform system-level tasks
        </p>
      </div>
      
      <div className="flex-grow bg-black bg-opacity-70 p-4 rounded-lg overflow-y-auto mb-4">
        {output.map((line, index) => (
          <div key={index} className="mb-1">
            {line}
          </div>
        ))}
        {isProcessing && (
          <div className="flex items-center">
            <div className="animate-pulse">Processing...</div>
          </div>
        )}
      </div>
      
      <form onSubmit={handleCommand} className="flex items-center">
        <span className="text-green-500 mr-2">$</span>
        <input
          className="flex-grow p-2 bg-black border border-green-500 text-green-400 focus:outline-none focus:ring-1 focus:ring-green-500 rounded"
          placeholder="Type command..."
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          disabled={isProcessing}
          autoFocus
        />
      </form>
    </div>
  );
};

export default FakeTerminal;