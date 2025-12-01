import React from 'react';
import { Home, Folder, User, Lightbulb } from 'lucide-react';
import { ViewState } from '../types';

interface NavbarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onChangeView }) => {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'projects', label: 'Proiecte', icon: Folder },
    { id: 'planner', label: 'Planner AI', icon: Lightbulb },
    { id: 'profile', label: 'Profil', icon: User },
  ];

  return (
    <nav className="
      fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe-bottom
      md:relative md:border-t-0 md:border-r md:w-64 md:h-full md:flex-col md:bg-slate-50
      z-50 shadow-lg md:shadow-none
    ">
      <div className="flex justify-around items-center h-16 md:h-auto md:flex-col md:justify-start md:space-y-2 md:p-4">
        
        <div className="hidden md:block mb-8 px-4 text-xl font-bold text-primary">
          WP Manager
        </div>

        {navItems.map((item) => {
          const isActive = currentView === item.id;
          const Icon = item.icon;
          
          return (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id as ViewState)}
              className={`
                flex flex-col md:flex-row items-center justify-center md:justify-start
                w-full md:px-4 md:py-3 rounded-xl transition-all duration-200
                ${isActive 
                  ? 'text-primary md:bg-blue-100' 
                  : 'text-slate-400 hover:text-slate-600 md:hover:bg-slate-200'}
              `}
            >
              <Icon size={24} className={isActive ? 'fill-blue-100/20' : ''} />
              <span className="text-[10px] md:text-sm md:ml-3 font-medium mt-1 md:mt-0">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};