
import React, { useState } from 'react';
import { User, Mail, Camera, Edit2, Save, Cpu, Key } from 'lucide-react';
import { UserProfile, AISettings, AIProvider } from '../../types';

interface ProfileViewProps {
  userProfile: UserProfile;
  aiSettings: AISettings;
  onUpdateProfile: (p: UserProfile) => void;
  onUpdateAISettings: (s: AISettings) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ userProfile, aiSettings, onUpdateProfile, onUpdateAISettings }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // Local state for edits
  const [localProfile, setLocalProfile] = useState(userProfile);
  const [localAI, setLocalAI] = useState(aiSettings);

  const saveProfile = () => {
    onUpdateProfile(localProfile);
    setIsEditing(false);
  };

  const saveAI = () => {
    onUpdateAISettings(localAI);
    alert('Configurația AI a fost salvată.');
  };

  return (
    <div className="p-6 space-y-8 pt-safe-top overflow-y-auto no-scrollbar pb-24">
      <header>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Setări & Profil</h1>
        <p className="text-slate-500 text-sm">Administrează contul și configurările AI.</p>
      </header>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="bg-blue-50 p-6 flex flex-col items-center justify-center relative">
          <button onClick={() => setIsEditing(!isEditing)} className="absolute top-4 right-4 p-2 bg-white rounded-full text-slate-500 hover:text-blue-600 shadow-sm">
            <Edit2 size={16} />
          </button>
          
          <div className="w-20 h-20 bg-blue-200 text-blue-600 rounded-full flex items-center justify-center mb-3 text-2xl font-bold overflow-hidden border-4 border-white shadow-lg">
             {localProfile.avatarUrl ? <img src={localProfile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : localProfile.name.charAt(0).toUpperCase()}
          </div>
          
          {!isEditing ? (
             <>
               <h2 className="text-xl font-bold text-slate-800">{localProfile.name}</h2>
               <p className="text-blue-600 text-xs font-bold uppercase tracking-wide bg-blue-100 px-3 py-1 rounded-full mt-2">{localProfile.role}</p>
             </>
          ) : (
             <p className="text-xs text-blue-600 font-bold">Mod editare activ</p>
          )}
        </div>

        <div className="p-6">
           {isEditing ? (
             <div className="space-y-4 animate-in fade-in">
                <input type="text" value={localProfile.name} onChange={(e) => setLocalProfile({...localProfile, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none" placeholder="Nume" />
                <input type="email" value={localProfile.email} onChange={(e) => setLocalProfile({...localProfile, email: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none" placeholder="Email" />
                <input type="text" value={localProfile.avatarUrl} onChange={(e) => setLocalProfile({...localProfile, avatarUrl: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none" placeholder="Avatar URL" />
                <button onClick={saveProfile} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl mt-2">Salvează</button>
             </div>
           ) : (
             <div className="space-y-3">
               <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                 <Mail size={18} className="text-slate-400" />
                 <div><p className="text-xs text-slate-400 uppercase font-bold">Email</p><p className="text-sm font-medium">{localProfile.email}</p></div>
               </div>
             </div>
           )}
        </div>
      </div>

      {/* AI Config */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-2">
          <div className="bg-purple-100 text-purple-600 p-2 rounded-lg"><Cpu size={20} /></div>
          <h3 className="font-bold text-slate-800">Configurare AI</h3>
        </div>
        <div className="p-6 space-y-5">
           <div>
             <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Provider</label>
             <div className="grid grid-cols-2 gap-2">
               {(['google', 'openai', 'deepseek', 'anthropic'] as AIProvider[]).map(p => (
                 <button key={p} onClick={() => setLocalAI({...localAI, provider: p})} className={`py-2 px-3 rounded-lg border font-bold text-xs capitalize ${localAI.provider === p ? 'bg-slate-900 text-white' : 'bg-white text-slate-500'}`}>
                   {p}
                 </button>
               ))}
             </div>
           </div>
           
           {(localAI.provider === 'openai' || localAI.provider === 'deepseek') && (
             <div>
               <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Base URL</label>
               <input type="text" value={localAI.baseUrl || ''} onChange={(e) => setLocalAI({...localAI, baseUrl: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none" placeholder="https://api..." />
             </div>
           )}

           <div>
             <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">API Key</label>
             <div className="relative">
               <input type={showKey ? "text" : "password"} value={localAI.apiKey} onChange={(e) => setLocalAI({...localAI, apiKey: e.target.value})} className="w-full pl-10 pr-12 bg-slate-50 border border-slate-200 rounded-lg py-3 text-sm outline-none font-mono" placeholder="sk-..." />
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Key size={16} /></div>
               <button onClick={() => setShowKey(!showKey)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 text-xs font-bold">{showKey ? "HIDE" : "SHOW"}</button>
             </div>
           </div>

           <div>
             <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Model Name</label>
             <input type="text" value={localAI.model} onChange={(e) => setLocalAI({...localAI, model: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none" />
           </div>

           <button onClick={saveAI} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"><Save size={18} /> Salvează Configurația</button>
        </div>
      </div>
    </div>
  );
};
