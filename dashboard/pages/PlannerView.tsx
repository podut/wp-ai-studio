
import React, { useState } from 'react';
import { ArrowLeft, Sparkles, Hash, Bot, Save, Calendar, Trash2, ChevronRight, Edit2, Folder, X, Play, CheckCircle, Clock, Zap, MapPin, Layers } from 'lucide-react';
import { PlannerView as PlannerViewType, Project, PlannerFolder, SavedKeyword, PlanItem, GeoSettings } from '../../types';
import { generateKeywords, generateClusterTopics } from '../../services/aiService';

interface PlannerViewProps {
  projects: Project[];
  folders: PlannerFolder[];
  onAddFolder: (name: string, keywords: string[]) => void;
  onDeleteFolder: (id: string) => void;
  onUpdateFolder: (id: string, name: string) => void;
  onUpdateFolderKeywords: (folderId: string, keywords: SavedKeyword[]) => void;
  onCreateStrategy: (folderId: string, keywords: string[]) => Promise<void>;
  onUpdatePlanItem: (folderId: string, itemId: string, updates: Partial<PlanItem>) => void;
  onGenerateItemContent: (folderId: string, item: PlanItem) => Promise<void>;
  onPublishPlanItem: (folderId: string, item: PlanItem, projectId: string) => Promise<void>;
}

export const PlannerView: React.FC<PlannerViewProps> = ({ 
  projects, folders, onAddFolder, onDeleteFolder, onUpdateFolder, onUpdateFolderKeywords, 
  onCreateStrategy, onUpdatePlanItem, onGenerateItemContent, onPublishPlanItem
}) => {
  const [view, setView] = useState<PlannerViewType>('menu');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  
  // Folder Tab State
  const [activeTab, setActiveTab] = useState<'keywords' | 'plan'>('keywords');

  // Generator State
  const [niche, setNiche] = useState('');
  const [details, setDetails] = useState('');
  const [keywordCount, setKeywordCount] = useState(10);
  
  // GEO & Cluster State
  const [isClusterMode, setIsClusterMode] = useState(false);
  const [geoSettings, setGeoSettings] = useState<GeoSettings>({ city: '', country: '' });

  const [results, setResults] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Strategy State
  const [isStrategyLoading, setIsStrategyLoading] = useState(false);
  const [itemProcessingId, setItemProcessingId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  // --- GENERATOR LOGIC ---

  const handleGenerateKeywords = async () => {
    if (!niche.trim()) return;
    setIsGenerating(true);
    setResults([]);
    try {
      let kw: string[] = [];
      if (isClusterMode) {
        kw = await generateClusterTopics(niche, geoSettings);
      } else {
        kw = await generateKeywords(niche, keywordCount, details, geoSettings);
      }
      setResults(kw);
    } catch (e: any) {
      alert(`AI Error: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveAll = () => {
    const validResults = results.filter(r => r.trim() !== '');
    if (validResults.length === 0) return;
    const folderName = isClusterMode ? `Cluster: ${niche}` : niche;
    onAddFolder(folderName || 'Proiect Nou', validResults);
    alert('Folder creat cu succes!');
    setResults([]);
    setNiche('');
    setView('menu');
  };

  // --- FOLDER LOGIC ---
  const activeFolder = folders.find(f => f.id === activeFolderId);

  const handleDeleteKeywordFromFolder = (kwId: string) => {
    if (!activeFolder) return;
    onUpdateFolderKeywords(activeFolder.id, activeFolder.keywords.filter(k => k.id !== kwId));
  };

  const runStrategy = async () => {
    if (!activeFolder || activeFolder.keywords.length === 0) return;
    setIsStrategyLoading(true);
    try {
      await onCreateStrategy(activeFolder.id, activeFolder.keywords.map(k => k.term));
      setActiveTab('plan');
    } catch (e: any) {
      alert(`Strategy Failed: ${e.message}`);
    } finally {
      setIsStrategyLoading(false);
    }
  };

  const runGenerateContent = async (item: PlanItem) => {
    if (!activeFolder) return;
    setItemProcessingId(item.id);
    try {
      await onGenerateItemContent(activeFolder.id, item);
    } catch (e: any) {
      alert(`Generation Failed: ${e.message}`);
    } finally {
      setItemProcessingId(null);
    }
  };

  const runPublish = async (item: PlanItem) => {
    if (!activeFolder || !selectedProjectId) {
      alert('Selectează un proiect WP mai întâi!');
      return;
    }
    setItemProcessingId(item.id);
    try {
      await onPublishPlanItem(activeFolder.id, item, selectedProjectId);
      alert('Articol publicat (Draft) în WordPress!');
    } catch (e: any) {
      alert(`Publish Failed: ${e.message}`);
    } finally {
      setItemProcessingId(null);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col pt-safe-top overflow-y-auto no-scrollbar pb-24">
      <header className="mb-6 flex items-center gap-2">
        {view !== 'menu' && (
          <button type="button" onClick={() => setView('menu')} className="p-1 rounded-full bg-slate-100 hover:bg-slate-200 mr-2">
            <ArrowLeft size={20} className="text-slate-600"/>
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="text-purple-500" /> Planner AI
          </h1>
          <p className="text-slate-500 text-sm">Strategie & Execuție.</p>
        </div>
      </header>

      {view === 'menu' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Main Action */}
          <button type="button" onClick={() => setView('keywords')} className="w-full bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-left hover:shadow-md transition-all group">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
                 <Hash size={24} />
               </div>
               <div>
                 <h3 className="text-lg font-bold text-slate-800 group-hover:text-purple-600">Generator Idei & Clustere</h3>
                 <p className="text-sm text-slate-500">Planuri Editoriale sau Topical Clusters.</p>
               </div>
               <ChevronRight className="ml-auto text-slate-300 group-hover:text-purple-400" />
            </div>
          </button>

          {/* Folders List */}
          <div>
             <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Folder size={18} /> Planurile Mele</h3>
             {folders.length === 0 ? (
               <div className="text-center p-8 bg-slate-100 rounded-2xl text-slate-400 text-sm">Nu ai niciun plan activ.</div>
             ) : (
               <div className="grid grid-cols-1 gap-3">
                 {folders.map(folder => (
                   <div key={folder.id} onClick={() => { setActiveFolderId(folder.id); setView('folder'); setActiveTab('plan'); }} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center cursor-pointer hover:border-purple-200 active:scale-[0.98] transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-lg flex items-center justify-center"><Calendar size={20}/></div>
                        <div>
                           <h4 className="font-bold text-slate-800 text-sm">{folder.name}</h4>
                           <p className="text-xs text-slate-400">
                             {folder.planItems?.length || 0} articole planificate
                           </p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-slate-300"/>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>
      )}

      {/* GENERATOR VIEW */}
      {view === 'keywords' && (
        <div className="animate-in slide-in-from-right-4 fade-in">
           <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-6 space-y-4">
              
              {/* Main Input */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Nișă / Subiect</label>
                <input type="text" value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Ex: Rețete vegane, Instalator..." className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500" />
              </div>

              {/* Mode Toggle */}
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button type="button" 
                  onClick={() => setIsClusterMode(false)}
                  className={`flex-1 py-2 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all ${!isClusterMode ? 'bg-white shadow-sm text-purple-600' : 'text-slate-500'}`}
                >
                  <Hash size={14} /> Keywords List
                </button>
                <button type="button" 
                  onClick={() => setIsClusterMode(true)}
                  className={`flex-1 py-2 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all ${isClusterMode ? 'bg-white shadow-sm text-purple-600' : 'text-slate-500'}`}
                >
                  <Layers size={14} /> Topic Cluster
                </button>
              </div>

              {/* Geo Settings */}
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                <h4 className="text-xs font-bold text-blue-800 mb-2 flex items-center gap-1"><MapPin size={12}/> Local SEO (GEO)</h4>
                <div className="flex gap-2">
                   <input type="text" value={geoSettings.city} onChange={e => setGeoSettings({...geoSettings, city: e.target.value})} placeholder="Oraș" className="flex-1 bg-white border border-blue-200 rounded-lg px-3 py-2 text-xs outline-none" />
                   <input type="text" value={geoSettings.country} onChange={e => setGeoSettings({...geoSettings, country: e.target.value})} placeholder="Țară" className="flex-1 bg-white border border-blue-200 rounded-lg px-3 py-2 text-xs outline-none" />
                </div>
              </div>

              {!isClusterMode && (
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase mb-2 flex justify-between"><span>Număr cuvinte cheie</span><span className="text-purple-600">{keywordCount}</span></label>
                   <input type="range" min="1" max="30" step="1" value={keywordCount} onChange={(e) => setKeywordCount(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600" />
                </div>
              )}

              <textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Detalii opționale despre publicul țintă..." className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none h-20 resize-none focus:ring-2 focus:ring-purple-500" />
              
              <button type="button" onClick={handleGenerateKeywords} disabled={isGenerating || !niche} className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                {isGenerating ? <Zap className="animate-spin" size={20} /> : <Sparkles size={20} />} Generează {isClusterMode ? 'Cluster' : 'Idei'}
              </button>
           </div>
           
           {results.length > 0 && (
              <div className="space-y-3">
                 <div className="flex justify-between items-center bg-purple-50 p-3 rounded-xl mb-2">
                    <h3 className="text-sm font-bold text-purple-800">Rezultate ({results.length})</h3>
                    <button type="button" onClick={handleSaveAll} className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg font-bold shadow-sm active:scale-95 transition-transform flex items-center gap-1">
                      <Save size={14} /> Salvează Plan
                    </button>
                 </div>
                 <div className="grid grid-cols-1 gap-2">
                   {results.map((kw, idx) => (
                      <div key={idx} className="bg-white p-2 pl-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
                           <span className="text-sm font-medium text-slate-700">{kw}</span>
                      </div>
                   ))}
                 </div>
              </div>
           )}
        </div>
      )}

      {/* FOLDER DETAILS VIEW */}
      {view === 'folder' && activeFolder && (
         <div className="animate-in slide-in-from-right-4 fade-in flex flex-col h-full">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center mb-4">
               <div>
                  <input 
                    className="font-bold text-lg text-slate-800 bg-transparent outline-none border-b border-transparent focus:border-purple-200 w-full" 
                    value={activeFolder.name} 
                    onChange={(e) => onUpdateFolder(activeFolder.id, e.target.value)} 
                  />
                  <p className="text-xs text-slate-400">Creat pe {new Date(activeFolder.createdAt).toLocaleDateString()}</p>
               </div>
               <button type="button" onClick={() => { onDeleteFolder(activeFolder.id); setView('menu'); }} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={20}/></button>
            </div>

            {/* TABS */}
            <div className="flex p-1 bg-slate-100 rounded-xl mb-4 shrink-0">
               <button type="button" onClick={() => setActiveTab('keywords')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'keywords' ? 'bg-white shadow-sm text-purple-600' : 'text-slate-400'}`}>Cuvinte Cheie ({activeFolder.keywords.length})</button>
               <button type="button" onClick={() => setActiveTab('plan')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'plan' ? 'bg-white shadow-sm text-purple-600' : 'text-slate-400'}`}>Calendar Editorial ({activeFolder.planItems?.length || 0})</button>
            </div>

            {/* KEYWORDS TAB */}
            {activeTab === 'keywords' && (
              <div className="space-y-4">
                 <div className="grid grid-cols-1 gap-2">
                    {activeFolder.keywords.map(k => (
                      <div key={k.id} className="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center">
                         <span className="text-sm font-medium text-slate-700">{k.term}</span>
                         <button type="button" onClick={() => handleDeleteKeywordFromFolder(k.id)} className="text-slate-300 hover:text-red-500"><X size={16}/></button>
                      </div>
                    ))}
                 </div>
                 {activeFolder.keywords.length > 0 && (
                   <button type="button" onClick={runStrategy} disabled={isStrategyLoading} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 mt-4">
                      {isStrategyLoading ? <Zap className="animate-spin" size={18}/> : <Calendar size={18} />} Generează Strategie Editorială
                   </button>
                 )}
              </div>
            )}

            {/* PLAN TAB */}
            {activeTab === 'plan' && (
              <div className="space-y-4 pb-20">
                 {(!activeFolder.planItems || activeFolder.planItems.length === 0) && (
                    <div className="text-center py-10">
                       <p className="text-slate-400 text-sm mb-4">Calendarul este gol.</p>
                       <button type="button" onClick={runStrategy} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold text-sm">Generează Acum</button>
                    </div>
                 )}

                 {/* Project Selector for Publishing */}
                 {activeFolder.planItems && activeFolder.planItems.length > 0 && (
                    <div className="bg-purple-50 p-3 rounded-xl mb-2">
                       <label className="text-[10px] font-bold text-purple-800 uppercase block mb-1">Publică pe:</label>
                       <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="w-full bg-white border border-purple-200 rounded-lg p-2 text-xs font-bold outline-none">
                          <option value="">-- Alege Proiect WP --</option>
                          {projects.filter(p=>p.status==='connected').map(p=>(
                             <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                       </select>
                    </div>
                 )}

                 {activeFolder.planItems?.map((item, idx) => (
                    <div key={item.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                       {/* Header */}
                       <div className="bg-slate-50 p-3 flex justify-between items-center border-b border-slate-100">
                          <div className="flex items-center gap-2">
                             <div className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                                <Clock size={10} /> {item.suggestedDate}
                             </div>
                             <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                                item.status === 'published' ? 'bg-green-100 text-green-700 border-green-200' : 
                                item.status === 'generated' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                'bg-blue-100 text-blue-700 border-blue-200'
                             }`}>
                                {item.status}
                             </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">KW: {item.keyword}</span>
                       </div>

                       {/* Body */}
                       <div className="p-4 space-y-3">
                          <div>
                             <label className="text-[10px] font-bold text-slate-400 uppercase">Titlu</label>
                             <input className="w-full text-sm font-bold text-slate-800 border-b border-slate-100 focus:border-purple-300 outline-none py-1" 
                               value={item.title} 
                               onChange={(e) => onUpdatePlanItem(activeFolder.id, item.id, { title: e.target.value })}
                             />
                          </div>
                          <div>
                             <label className="text-[10px] font-bold text-slate-400 uppercase">Slug</label>
                             <input className="w-full text-xs font-mono text-slate-600 border-b border-slate-100 focus:border-purple-300 outline-none py-1" 
                               value={item.slug} 
                               onChange={(e) => onUpdatePlanItem(activeFolder.id, item.id, { slug: e.target.value })}
                             />
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 mt-2">
                             {item.status === 'planned' && (
                                <button type="button"
                                  onClick={() => runGenerateContent(item)}
                                  disabled={itemProcessingId === item.id}
                                  className="flex-1 bg-blue-600 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 disabled:opacity-50"
                                >
                                  {itemProcessingId === item.id ? <Zap className="animate-spin" size={14}/> : <Bot size={14}/>} Generează Conținut
                                </button>
                             )}
                             
                             {item.status === 'generated' && (
                                <button type="button"
                                  onClick={() => runGenerateContent(item)} // Regenerate
                                  disabled={itemProcessingId === item.id}
                                  className="px-3 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg"
                                >
                                  <Zap size={14}/>
                                </button>
                             )}

                             {(item.status === 'generated' || item.status === 'published') && (
                                <button type="button"
                                   onClick={() => runPublish(item)}
                                   disabled={itemProcessingId === item.id}
                                   className="flex-1 bg-green-600 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 disabled:opacity-50"
                                >
                                   {itemProcessingId === item.id ? <Zap className="animate-spin" size={14}/> : <CheckCircle size={14}/>} {item.status === 'published' ? 'Re-Publică' : 'Trimite la WP'}
                                </button>
                             )}
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
            )}
         </div>
      )}
    </div>
  );
};
