import React from "react";

const Dashboard = ({ logs }) => {
  return (
    <div className="p-6 bg-gray-950 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Cowrie Logs & Blockchain Events</h1>
      <table className="w-full border border-gray-700">
        <thead>
          <tr className="bg-gray-800 text-left">
            <th className="p-2 border">Timestamp</th>
            <th className="p-2 border">IP</th>
            <th className="p-2 border">Command</th>
            <th className="p-2 border">Threat</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, index) => (
            <tr key={index} className="border-t border-gray-700">
              <td className="p-2">{log.timestamp}</td>
              <td className="p-2">{log.ip}</td>
              <td className="p-2 text-yellow-400">{log.command}</td>
              <td className={`p-2 ${log.threatLevel > 5 ? "text-red-500" : "text-green-400"}`}>
                {log.threatLevel}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Dashboard;
