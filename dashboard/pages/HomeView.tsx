
import React from 'react';
import { Folder as FolderIcon, Wifi } from 'lucide-react';
import { Project, ViewState } from '../../types';

interface HomeViewProps {
  projects: Project[];
  onChangeView: (view: ViewState) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ projects, onChangeView }) => {
  return (
    <div className="p-6 space-y-6 pt-safe-top">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Bine ai venit!</h1>
        <p className="text-slate-500">Gestionează-ți proiectele și conexiunile WP.</p>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <div 
          onClick={() => onChangeView('projects')}
          className="bg-blue-600 text-white p-6 rounded-2xl shadow-lg shadow-blue-200 active:scale-95 transition-transform cursor-pointer"
        >
          <FolderIcon className="mb-4" size={32} />
          <h3 className="font-bold text-lg">{projects.length}</h3>
          <p className="text-blue-100 text-sm">Proiecte Totale</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200">
          <Wifi size={32} className="mb-4 text-green-500" />
          <h3 className="font-bold text-lg text-slate-800">
            {projects.filter(p => p.status === 'connected').length}
          </h3>
          <p className="text-slate-400 text-sm">Site-uri Conectate</p>
        </div>
      </div>
    </div>
  );
};
