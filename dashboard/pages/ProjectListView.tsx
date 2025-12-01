
import React, { useState } from 'react';
import { Plus, Folder as FolderIcon } from 'lucide-react';
import { Project } from '../../types';

interface ProjectListViewProps {
  projects: Project[];
  onAddProject: (name: string) => void;
  onOpenProject: (project: Project) => void;
}

export const ProjectListView: React.FC<ProjectListViewProps> = ({ projects, onAddProject, onOpenProject }) => {
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const handleAdd = () => {
    if (!newProjectName.trim()) return;
    onAddProject(newProjectName);
    setNewProjectName('');
    setIsAddingProject(false);
  };

  return (
    <div className="p-6 h-full flex flex-col pt-safe-top">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Proiecte</h2>
        <button 
          onClick={() => setIsAddingProject(!isAddingProject)}
          className="bg-slate-900 text-white p-2 rounded-full shadow-lg active:scale-90 transition-transform"
        >
          <Plus size={24} />
        </button>
      </div>

      {isAddingProject && (
        <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-100 animate-in slide-in-from-top-4 fade-in">
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Nume Proiect</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Ex: Magazin Online"
              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button 
              onClick={handleAdd}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium"
            >
              Adaugă
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto pb-24 no-scrollbar">
        {projects.map(proj => (
          <div 
            key={proj.id} 
            onClick={() => onOpenProject(proj)}
            className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center aspect-square hover:bg-slate-50 active:scale-95 transition-all cursor-pointer relative"
          >
            <div className={`absolute top-3 right-3 w-3 h-3 rounded-full ${
              proj.status === 'connected' ? 'bg-green-500' : 
              proj.status === 'error' ? 'bg-red-500' : 'bg-slate-200'
            }`} />

            <FolderIcon className="text-blue-500 mb-3" size={40} strokeWidth={1.5} />
            <span className="font-medium text-slate-700 text-sm line-clamp-2">{proj.name}</span>
            <span className="text-xs text-slate-400 mt-1">
              {proj.posts.length > 0 ? `${proj.posts.length} intrări` : 'Gol'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
