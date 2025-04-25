import React from "react";

const NotFound = () => {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
      <h1 className="text-4xl mb-4">404 - Page Not Found</h1>
      <p>You're trying to access a restricted or broken link.</p>
    </div>
  );
};

export default NotFound;
