import React from "react";

const FakeAdmin = () => {
  return (
    <div className="min-h-screen bg-[#111827] text-white flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold mb-4">Fake Admin Panel</h1>
      <p className="text-yellow-400">System access granted. Performing system audit...</p>
      <div className="mt-6 w-full max-w-2xl bg-gray-900 p-4 rounded">
        <p className="text-sm text-gray-400">Admin interface v1.0.0 - Outdated & Vulnerable</p>
        <ul className="mt-4 space-y-2 text-red-400">
          <li>• SSH Gateway open</li>
          <li>• Root login permitted</li>
          <li>• Logs exposed to user</li>
        </ul>
      </div>
    </div>
  );
};

export default FakeAdmin;
