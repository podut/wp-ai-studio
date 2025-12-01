
import React from 'react';

export const WelcomeView: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full bg-slate-50 p-6">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold text-slate-800 mb-4">WP Manager</h1>
        <p className="text-slate-500 mb-8">Gestionează site-urile WordPress direct de pe mobil cu puterea AI.</p>
        <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200">
           <p className="text-sm text-slate-400">Începe prin a adăuga un proiect din meniul principal.</p>
        </div>
      </div>
    </div>
  );
};
