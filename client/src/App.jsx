import React from 'react';

function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
      <div className="max-w-lg rounded-2xl border border-slate-700 bg-slate-800 p-8 text-center shadow-2xl">
        <h1 className="mb-4 text-3xl font-bold text-sky-400">
          SABMS Frontend Platform
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-slate-300">
          Smart Auditorium Booking & Management System built with React, Vite,
          Tailwind CSS, Zustand, and TanStack Query.
        </p>
        <div className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-400">
          System Foundation Initialized
        </div>
      </div>
    </div>
  );
}

export default App;
