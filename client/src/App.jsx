import React from 'react';

function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
      <div className="text-center p-8 rounded-2xl bg-slate-800 shadow-2xl border border-slate-700 max-w-lg">
        <h1 className="text-3xl font-bold text-sky-400 mb-4">
          SABMS Frontend Platform
        </h1>
        <p className="text-slate-300 text-sm leading-relaxed mb-6">
          Smart Auditorium Booking & Management System built with React, Vite, Tailwind CSS, Zustand, and TanStack Query.
        </p>
        <div className="inline-flex items-center px-4 py-2 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          System Foundation Initialized
        </div>
      </div>
    </div>
  );
}

export default App;
