import React, { useEffect, useState } from "react";

const FakeAdmin = () => {
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setIsComplete(true);
          return 100;
        }
        return prev + 10;
      });
    }, 300);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#111827] text-gray-900 dark:text-white flex flex-col items-center justify-center p-4 transition-colors duration-200">
      <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-lg shadow-lg w-full max-w-4xl transition-all duration-200">
        <h1 className="text-2xl md:text-3xl font-bold mb-4 text-center">
          Fake Admin Panel
        </h1>
        
        <div className="mb-6">
          <p className={`text-center mb-4 transition-colors duration-200 ${
            isComplete ? "text-green-500" : "text-yellow-500"
          }`}>
            {isComplete 
              ? "System audit complete - Vulnerabilities found!" 
              : "Performing system audit..."}
          </p>
          
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        <div className="mt-6 w-full bg-gray-50 dark:bg-gray-900 p-4 md:p-6 rounded-lg transition-all duration-200">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Admin interface v1.0.0 - Outdated & Vulnerable
          </p>
          
          <ul className="space-y-3">
            <li className="flex items-start">
              <span className="text-red-500 dark:text-red-400 mr-2">•</span>
              <span className="text-red-600 dark:text-red-400">SSH Gateway open (port 22)</span>
            </li>
            <li className="flex items-start">
              <span className="text-red-500 dark:text-red-400 mr-2">•</span>
              <span className="text-red-600 dark:text-red-400">Root login permitted with weak credentials</span>
            </li>
            <li className="flex items-start">
              <span className="text-red-500 dark:text-red-400 mr-2">•</span>
              <span className="text-red-600 dark:text-red-400">System logs exposed to unauthenticated users</span>
            </li>
            {isComplete && (
              <li className="flex items-start">
                <span className="text-red-500 dark:text-red-400 mr-2">•</span>
                <span className="text-red-600 dark:text-red-400">Critical: Database credentials in config files</span>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FakeAdmin;