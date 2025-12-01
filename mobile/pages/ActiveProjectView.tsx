
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, RefreshCw, Settings, X, Globe, AlertCircle, Wifi, 
  WifiOff, Layout, List, Plus, ChevronRight, FileText, Edit2, 
  PenTool, Trash2, Tags, ChevronUp, ChevronDown, Search, Save, Send, Copy,
  Eye, EyeOff, Zap, CheckCircle, HelpCircle, FileCheck, Eraser, Activity, Wand2, Image as ImageIcon, Folder, Link
} from 'lucide-react';
import { Project, WPPost, AEOAuditResult, ImageGenOptions } from '../../types';
import { createCategory, createTag, createPost, updatePost, deletePost, uploadMedia } from '../../services/wpService';
import { generateAnswerParagraph, generateTLDR, generateFAQSchema, cleanHTML, auditSEOContent, generateSEOMetadata, generateFeaturedImage, generateInternalLinks } from '../../services/aiService';

interface ActiveProjectViewProps {
  project: Project;
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  onClose: () => void;
  onSync: (project: Project, silent?: boolean) => Promise<void>;
  onConnect: (project: Project) => Promise<void>;
  loadingProjectId: string | null;
}

interface EditorState {
  id?: number;
  title: string;
  content: string;
  status: 'publish' | 'draft';
  seoTitle: string;
  seoDesc: string;
  seoFocusKw: string;
  categories: number[];
  tags: number[];
  featured_media?: number;
  featuredMediaUrl?: string; // New field for preview
}

export const ActiveProjectView: React.FC<ActiveProjectViewProps> = ({ 
  project, onUpdateProject, onClose, onSync, onConnect, loadingProjectId 
}) => {
  const [subView, setSubView] = useState<'dashboard' | 'list' | 'editor'>('dashboard');
  const [isEditingConfig, setIsEditingConfig] = useState(project.status !== 'connected');
  const [filterStatus, setFilterStatus] = useState<'all' | 'publish' | 'draft'>('all');
  
  // Editor State
  const [editorData, setEditorData] = useState<EditorState>({
    title: '', content: '', status: 'draft', seoTitle: '', seoDesc: '', seoFocusKw: '', categories: [], tags: []
  });
  
  // Editor UI State
  const [editorTab, setEditorTab] = useState<'edit' | 'preview' | 'aeo'>('edit');
  const [isSeoOpen, setIsSeoOpen] = useState(false);
  const [isTaxonomyOpen, setIsTaxonomyOpen] = useState(false);
  const [isTagOpen, setIsTagOpen] = useState(false);
  
  // Taxonomy Search State
  const [catSearch, setCatSearch] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newTagName, setNewTagName] = useState('');
  
  // Fullscreen Preview State
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');

  const [processing, setProcessing] = useState(false);
  
  // AEO State
  const [aeoAudit, setAeoAudit] = useState<AEOAuditResult | null>(null);
  const [aeoProcessing, setAeoProcessing] = useState(false);

  // Image Gen State
  const [imgOptions, setImgOptions] = useState<ImageGenOptions>({ style: 'realistic', aspectRatio: '16:9' });
  const [generatedPrompt, setGeneratedPrompt] = useState('');

  useEffect(() => {
    // If not connected, force config open
    if (project.status !== 'connected') setIsEditingConfig(true);
    else setIsEditingConfig(false);
  }, [project.status]);

  const handleCreateNew = () => {
    setEditorData({
      title: '', content: '', status: 'draft', seoTitle: '', seoDesc: '', seoFocusKw: '', categories: [], tags: []
    });
    setSubView('editor');
    setEditorTab('edit');
    setAeoAudit(null);
    setGeneratedPrompt('');
  };

  const handleEditPost = (post: WPPost) => {
    setEditorData({
      id: post.id,
      title: post.title.raw || post.title.rendered,
      content: post.content.raw || post.content.rendered,
      status: post.status as 'publish' | 'draft',
      seoTitle: post.meta?._yoast_wpseo_title || '',
      seoDesc: post.meta?._yoast_wpseo_metadesc || '',
      seoFocusKw: post.meta?._yoast_wpseo_focuskw || '',
      categories: post.categories || [],
      tags: post.tags || [],
      featured_media: post.featured_media,
      // Note: We don't have the URL here unless we fetch media, but new uploads will show
      featuredMediaUrl: '' 
    });
    setSubView('editor');
    setEditorTab('edit');
    setAeoAudit(null);
    setGeneratedPrompt('');
  };

  const handleSavePost = async (targetStatus?: 'publish' | 'draft') => {
    // Prevent reload
    if (processing) return;
    setProcessing(true);
    const status = targetStatus || editorData.status;
    const payload: any = {
      title: editorData.title,
      content: editorData.content,
      status: status,
      categories: editorData.categories,
      tags: editorData.tags,
      featured_media: editorData.featured_media,
      meta: {
        _yoast_wpseo_title: editorData.seoTitle,
        _yoast_wpseo_metadesc: editorData.seoDesc,
        _yoast_wpseo_focuskw: editorData.seoFocusKw
      }
    };

    try {
      if (editorData.id) {
        await updatePost(project.credentials, editorData.id, payload);
      } else {
        await createPost(project.credentials, payload);
      }
      await onSync(project, true);
      setSubView('list');
      setFilterStatus(status === 'publish' ? 'publish' : 'draft');
    } catch (e: any) {
      alert(`Eroare: ${e.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleDuplicatePost = async () => {
    if (processing) return;
    setProcessing(true);
    const payload: any = {
      title: `${editorData.title} (Copie)`,
      content: editorData.content,
      status: 'draft',
      categories: editorData.categories,
      tags: editorData.tags,
      featured_media: editorData.featured_media,
      meta: {
        _yoast_wpseo_title: editorData.seoTitle,
        _yoast_wpseo_metadesc: editorData.seoDesc,
        _yoast_wpseo_focuskw: editorData.seoFocusKw
      }
    };

    try {
      await createPost(project.credentials, payload);
      await onSync(project, true);
      alert('Articol duplicat cu succes!');
      setSubView('list');
      setFilterStatus('draft');
    } catch (e: any) {
      alert(`Eroare la clonare: ${e.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleDeletePost = async () => {
    if(!editorData.id || !window.confirm("Sigur ștergi?")) return;
    setProcessing(true);
    try {
      await deletePost(project.credentials, editorData.id);
      await onSync(project);
      setSubView('list');
    } catch(e:any) {
      alert(e.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateTax = async (type: 'cat' | 'tag') => {
    const name = type === 'cat' ? newCatName : newTagName;
    if(!name.trim()) return;
    try {
      const res = type === 'cat' 
        ? await createCategory(project.credentials, name)
        : await createTag(project.credentials, name);
      
      const list = type === 'cat' ? project.categories : project.tags;
      const key = type === 'cat' ? 'categories' : 'tags';
      
      if(!list.find(i => i.id === res.id)) {
        onUpdateProject(project.id, { [key]: [...list, res] });
      }
      
      setEditorData(prev => ({
        ...prev,
        [key]: [...prev[key as 'categories'|'tags'], res.id]
      }));
      
      if(type === 'cat') setNewCatName(''); else setNewTagName('');

    } catch(e:any) {
      if(e.message === 'PERMISSION_DENIED') alert('Nu ai permisiunea de a crea termeni pe acest site.');
      else alert(`Eroare: ${e.message}`);
    }
  };

  // --- AEO HANDLERS ---

  const handleInjectSnippet = async () => {
    setAeoProcessing(true);
    try {
      const snippet = await generateAnswerParagraph(editorData.content || editorData.title);
      setEditorData(prev => ({ ...prev, content: snippet + '\n\n' + prev.content }));
      
      // FIX IT logic: update audit state immediately
      if (aeoAudit) {
        setAeoAudit(prev => prev ? ({
          ...prev, 
          score: Math.min(100, prev.score + 10), // Boost score slightly
          checklist: { ...prev.checklist, hasAnswerParagraph: true }
        }) : null);
      }

      alert('Answer Paragraph inserat!');
    } catch(e:any) { alert(e.message); }
    setAeoProcessing(false);
  };

  const handleInjectTLDR = async () => {
    setAeoProcessing(true);
    try {
      const tldr = await generateTLDR(editorData.content);
      setEditorData(prev => ({ ...prev, content: tldr + '\n\n' + prev.content }));
      
      // FIX IT logic
      if (aeoAudit) {
         setAeoAudit(prev => prev ? ({
          ...prev, 
          score: Math.min(100, prev.score + 10),
          checklist: { ...prev.checklist, hasTLDR: true }
        }) : null);
      }
      
      alert('TL;DR inserat!');
    } catch(e:any) { alert(e.message); }
    setAeoProcessing(false);
  };

  const handleGenerateFAQ = async () => {
    setAeoProcessing(true);
    try {
      const res = await generateFAQSchema(editorData.content);
      const injection = `\n\n${res.html}\n<script type="application/ld+json">${res.jsonLD}</script>`;
      setEditorData(prev => ({ ...prev, content: prev.content + injection }));
      
      // FIX IT logic
      if (aeoAudit) {
         setAeoAudit(prev => prev ? ({
          ...prev, 
          score: Math.min(100, prev.score + 10),
          checklist: { ...prev.checklist, hasFAQ: true }
        }) : null);
      }
      
      alert('FAQ & Schema inserate!');
    } catch(e:any) { alert(e.message); }
    setAeoProcessing(false);
  };

  const handleCleanHTML = async () => {
    setAeoProcessing(true);
    try {
      const keyword = editorData.seoFocusKw || editorData.title;
      const cleaned = await cleanHTML(editorData.content, keyword);
      setEditorData(prev => ({ ...prev, content: cleaned }));
      alert('HTML Curățat & Optimizat!');
    } catch(e:any) { alert(e.message); }
    setAeoProcessing(false);
  };

  const handleLinkBuilding = async () => {
    setAeoProcessing(true);
    try {
        // Context: Get all published posts except the current one
        const validPosts = project.posts
            .filter(p => p.status === 'publish' && p.id !== editorData.id)
            .map(p => ({ 
                title: p.title.rendered || p.title.raw || '', 
                link: p.link 
            }));

        if (validPosts.length === 0) {
            alert("Nu există alte articole publicate pentru a crea link-uri interne.");
            setAeoProcessing(false);
            return;
        }

        const linked = await generateInternalLinks(editorData.content, validPosts);
        setEditorData(prev => ({ ...prev, content: linked }));
        alert('Link-uri interne generate!');
    } catch(e:any) {
        alert(e.message);
    }
    setAeoProcessing(false);
  };

  const handleAuditSEO = async () => {
    setAeoProcessing(true);
    try {
      const res = await auditSEOContent(
        editorData.content, 
        editorData.seoFocusKw || editorData.title,
        editorData.seoTitle, 
        editorData.seoDesc
      );
      setAeoAudit(res);
    } catch(e:any) { alert(e.message); }
    setAeoProcessing(false);
  };

  const handleAutoGenerateSEO = async () => {
    if (!editorData.seoFocusKw) {
        alert("Introdu întâi un 'Focus Keyword'!");
        return;
    }
    setAeoProcessing(true);
    try {
        const res = await generateSEOMetadata(editorData.content, editorData.seoFocusKw);
        setEditorData(prev => ({
            ...prev,
            seoTitle: res.seoTitle,
            seoDesc: res.seoDesc
        }));
        alert("Metadate SEO Generate!");
    } catch(e:any) { alert(e.message); }
    setAeoProcessing(false);
  };

  // --- IMAGE GEN HANDLER ---
  
  const base64ToBlob = (base64: string, mimeType: string) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  const handleGenerateImage = async (refinement?: string) => {
    setAeoProcessing(true);
    setGeneratedPrompt('');
    try {
        // Append refinement to content/title context if exists
        const context = refinement 
          ? `Original Title: ${editorData.title}. Content: ${editorData.content.substring(0,200)}. Refinement Request: ${refinement}`
          : editorData.content;
          
        const result = await generateFeaturedImage(editorData.title, context, imgOptions);
        
        if (result.base64) {
            // Convert to blob and upload
            const blob = base64ToBlob(result.base64, 'image/jpeg');
            const fileName = `ai-generated-${Date.now()}.jpg`;
            const uploaded = await uploadMedia(project.credentials, blob, fileName);
            
            // Set as featured image and store URL
            setEditorData(prev => ({ 
              ...prev, 
              featured_media: uploaded.id,
              featuredMediaUrl: uploaded.source_url 
            }));
            
            // Auto update post if it exists
            if (editorData.id) {
                await updatePost(project.credentials, editorData.id, { featured_media: uploaded.id });
            }
            
            // If we refined, close the modal maybe? Or keep it open to see result.
            // For better UX, we just update the preview.
            alert('Imagine generată și setată cu succes!');
            setRefinePrompt(''); 
        } else if (result.prompt) {
            setGeneratedPrompt(result.prompt);
            alert('Generarea imaginii directe nu este disponibilă cu acest model. Am generat un prompt optimizat.');
        }
    } catch (e: any) {
        alert(`Eroare imagine: ${e.message}`);
    } finally {
        setAeoProcessing(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 font-sans">
      {/* Header */}
      <div className="p-4 bg-white/80 backdrop-blur shadow-sm z-20 flex items-center gap-3 sticky top-0 pt-safe-top">
        <button type="button" onClick={() => { if(subView !== 'dashboard') setSubView('dashboard'); else onClose(); }} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
          <ArrowLeft size={24} className="text-slate-600" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-800 leading-tight">{project.name}</h2>
          <div className="flex items-center gap-1.5 mt-0.5">
             <span className={`w-2 h-2 rounded-full ${project.status === 'connected' ? 'bg-green-500' : 'bg-slate-300'}`} />
             <span className="text-xs text-slate-500 font-medium">{project.status === 'connected' ? 'Online' : 'Offline'}</span>
          </div>
        </div>
        {project.status === 'connected' && (
          <button type="button" onClick={() => onSync(project)} className={`p-2 rounded-full bg-blue-50 text-blue-600 ${loadingProjectId === project.id ? 'animate-spin' : ''}`}>
            <RefreshCw size={20} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-32 no-scrollbar">
        {/* CONFIG CARD */}
        {(subView === 'dashboard' || project.status !== 'connected') && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-6 overflow-hidden transition-all duration-300">
            {!isEditingConfig ? (
              <div className="p-4 flex items-center justify-between group cursor-pointer hover:bg-slate-50" onClick={() => setIsEditingConfig(true)}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${project.status === 'connected' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Globe size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">{project.name}</h3>
                    <p className="text-xs text-slate-500 font-medium truncate max-w-[180px]">
                      {project.credentials.url ? project.credentials.url.replace(/^https?:\/\//, '') : 'Tap to configure URL'}
                    </p>
                  </div>
                </div>
                <button type="button" className="p-2 text-slate-400 hover:text-blue-600 bg-transparent rounded-full"><Edit2 size={18} /></button>
              </div>
            ) : (
              <div className="p-5 animate-in fade-in slide-in-from-top-2">
                 <div className="flex justify-between mb-4">
                    <h3 className="font-bold flex items-center gap-2"><Settings size={18}/> Configurare</h3>
                    <button type="button" onClick={() => setIsEditingConfig(false)}><X size={20} className="text-slate-400" /></button>
                 </div>
                 
                 <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">Website URL</label>
                      <input type="url" value={project.credentials.url} onChange={(e) => onUpdateProject(project.id, { credentials: { ...project.credentials, url: e.target.value } })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all" placeholder="https://..." />
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">Username</label>
                        <input type="text" value={project.credentials.username} onChange={(e) => onUpdateProject(project.id, { credentials: { ...project.credentials, username: e.target.value } })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all" placeholder="ex: admin" />
                      </div>
                      
                      <div>
                        <div className="flex justify-between items-center mb-1">
                           <label className="text-xs font-bold text-slate-500 uppercase ml-1 block">Application Password</label>
                           <a href="https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/" target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 font-bold hover:underline">Cum obțin parola?</a>
                        </div>
                        <input type="password" value={project.credentials.appPassword} onChange={(e) => onUpdateProject(project.id, { credentials: { ...project.credentials, appPassword: e.target.value } })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono" placeholder="xxxx xxxx xxxx xxxx xxxx xxxx" />
                        <p className="text-[10px] text-slate-400 mt-1 ml-1">Generează în WP Admin &gt; Users &gt; Profile &gt; Application Passwords.</p>
                      </div>
                    </div>
                    
                    {/* Error Message Display */}
                    {project.status === 'error' && (
                      <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xs flex flex-col gap-1">
                        <div className="flex items-center gap-2 font-bold"><AlertCircle size={14} /> Eroare la conectare:</div>
                        <span className="ml-5 font-medium">{project.lastErrorMessage || 'Verifică datele introduse.'}</span>
                      </div>
                    )}

                    <button type="button" onClick={() => onConnect(project)} disabled={loadingProjectId === project.id} className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl flex justify-center items-center gap-2 shadow-lg active:scale-95 transition-transform">
                       {loadingProjectId === project.id ? <RefreshCw className="animate-spin" size={18} /> : <Wifi size={18} />}
                       {project.status === 'connected' ? 'Re-Conectează' : 'Conectează'}
                    </button>
                 </div>
              </div>
            )}
          </div>
        )}

        {/* DASHBOARD */}
        {project.status === 'connected' && subView === 'dashboard' && (
           <div className="grid grid-cols-1 gap-4 animate-in fade-in">
              <div className="grid grid-cols-2 gap-3 mb-2">
                 <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <div className="text-2xl font-bold text-green-600">{project.posts.filter(p => p.status === 'publish').length}</div>
                    <div className="text-xs text-slate-400 font-medium">Publicate</div>
                 </div>
                 <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <div className="text-2xl font-bold text-amber-500">{project.posts.filter(p => p.status === 'draft').length}</div>
                    <div className="text-xs text-slate-400 font-medium">Draft-uri</div>
                 </div>
              </div>
              
              <button type="button" onClick={() => setSubView('list')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-left hover:shadow-md transition-all group">
                 <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><List size={24}/></div>
                 <h3 className="text-lg font-bold text-slate-800">Toate Articolele</h3>
                 <p className="text-sm text-slate-500 mt-1 mb-4">Gestionează articolele.</p>
                 <span className="text-blue-600 text-xs font-bold flex items-center ml-auto">Deschide <ChevronRight size={14}/></span>
              </button>

              <button type="button" onClick={() => handleCreateNew} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-left hover:shadow-md transition-all group">
                 <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Plus size={24}/></div>
                 <h3 className="text-lg font-bold text-slate-800">Creează Articol</h3>
                 <p className="text-sm text-slate-500 mt-1 mb-4">Scrie și publică rapid.</p>
                 <span className="text-indigo-600 text-xs font-bold flex items-center ml-auto">Începe <ChevronRight size={14}/></span>
              </button>
           </div>
        )}

        {/* LIST */}
        {project.status === 'connected' && subView === 'list' && (
           <div className="animate-in slide-in-from-right-4 fade-in">
              <div className="flex items-center justify-between mb-4">
                 <h3 className="font-bold text-slate-800">Articole</h3>
                 <button type="button" onClick={handleCreateNew} className="bg-slate-900 text-white p-2 rounded-lg shadow-md active:scale-95"><Plus size={18}/></button>
              </div>
              <div className="flex p-1 bg-slate-100 rounded-xl mb-4">
                {(['all', 'publish', 'draft'] as const).map(s => (
                  <button key={s} type="button" onClick={() => setFilterStatus(s)} className={`flex-1 py-1.5 text-xs font-bold rounded-lg capitalize transition-all ${filterStatus === s ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>{s}</button>
                ))}
              </div>
              <div className="space-y-3 pb-24">
                 {project.posts.filter(p => filterStatus === 'all' || p.status === filterStatus).map(post => (
                    <div key={post.id} onClick={() => handleEditPost(post)} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 cursor-pointer hover:border-blue-200 active:scale-[0.98] transition-all">
                       <h4 className="font-bold text-sm mb-1.5 line-clamp-2" dangerouslySetInnerHTML={{__html: post.title.rendered}}/>
                       <span className={`text-[9px] uppercase font-bold px-2 py-1 rounded-md border ${post.status === 'publish' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{post.status}</span>
                    </div>
                 ))}
                 {project.posts.length === 0 && <p className="text-center text-slate-400 py-10">Niciun articol.</p>}
              </div>
           </div>
        )}

        {/* EDITOR */}
        {project.status === 'connected' && subView === 'editor' && (
           <div className="animate-in slide-in-from-right-4 fade-in flex flex-col pb-6">
              {/* Editor Header Actions */}
              <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-2">
                    <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg"><PenTool size={20}/></div>
                    <div><h3 className="font-bold text-slate-800">{editorData.id ? 'Editare' : 'Nou'}</h3><p className="text-xs text-slate-500">{editorData.status}</p></div>
                 </div>
                 <div className="flex gap-2">
                    {editorData.id && <button type="button" onClick={handleDuplicatePost} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg"><Copy size={20}/></button>}
                    {editorData.id && <button type="button" onClick={handleDeletePost} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={20}/></button>}
                 </div>
              </div>

              {/* EDITOR TABS */}
              <div className="flex p-1 bg-slate-100 rounded-xl mb-4">
                 <button type="button" onClick={() => setEditorTab('edit')} className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${editorTab === 'edit' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}><Edit2 size={14}/> Edit</button>
                 <button type="button" onClick={() => setEditorTab('preview')} className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${editorTab === 'preview' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}><Eye size={14}/> Preview</button>
                 <button type="button" onClick={() => setEditorTab('aeo')} className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${editorTab === 'aeo' ? 'bg-white shadow-sm text-purple-600' : 'text-slate-400'}`}><Zap size={14}/> AEO Studio</button>
              </div>

              {/* TAB CONTENT: EDIT */}
              {editorTab === 'edit' && (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4 mb-4">
                   <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Titlu</label><input type="text" value={editorData.title} onChange={(e) => setEditorData({...editorData, title: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100" placeholder="Titlu..." /></div>
                   <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Conținut</label><textarea value={editorData.content} onChange={(e) => setEditorData({...editorData, content: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm h-64 outline-none font-mono focus:ring-2 focus:ring-blue-100" placeholder="HTML Content..." /></div>
                </div>
              )}

              {/* TAB CONTENT: PREVIEW */}
              {editorTab === 'preview' && (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-4 overflow-hidden">
                   <h1 className="text-2xl font-bold mb-4">{editorData.title}</h1>
                   {/* Featured Image Preview */}
                   {(editorData.featuredMediaUrl || editorData.featured_media) && (
                     <div 
                       className="mb-4 rounded-xl overflow-hidden h-48 bg-slate-100 relative cursor-pointer"
                       onClick={() => editorData.featuredMediaUrl && setIsFullscreenPreview(true)}
                     >
                        {editorData.featuredMediaUrl ? (
                          <img src={editorData.featuredMediaUrl} alt="Featured" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 flex-col gap-2">
                             <ImageIcon size={32} />
                             <span className="text-xs">Image ID: {editorData.featured_media}</span>
                          </div>
                        )}
                        {editorData.featuredMediaUrl && (
                           <div className="absolute top-2 right-2 bg-black/50 p-1 rounded-full text-white">
                              <Eye size={16} />
                           </div>
                        )}
                     </div>
                   )}
                   <div className="prose prose-sm prose-slate max-w-none" dangerouslySetInnerHTML={{__html: editorData.content || '<p class="text-slate-400 italic">Niciun conținut...</p>'}} />
                </div>
              )}
              
              {/* Fullscreen Modal for Preview */}
              {isFullscreenPreview && editorData.featuredMediaUrl && (
                <div className="fixed inset-0 z-50 bg-black/95 flex flex-col p-4 animate-in fade-in">
                   <div className="flex justify-end mb-2">
                      <button onClick={() => setIsFullscreenPreview(false)} className="p-2 bg-white/20 rounded-full text-white hover:bg-white/30"><X size={24}/></button>
                   </div>
                   <div className="flex-1 flex items-center justify-center overflow-hidden">
                      <img src={editorData.featuredMediaUrl} alt="Fullscreen" className="max-w-full max-h-full object-contain" />
                   </div>
                   <div className="mt-4 bg-white/10 p-3 rounded-xl backdrop-blur-md">
                      <label className="text-xs font-bold text-white/70 uppercase mb-1 block">Rafinează cu AI</label>
                      <div className="flex gap-2">
                         <input 
                            value={refinePrompt} 
                            onChange={(e) => setRefinePrompt(e.target.value)} 
                            placeholder="Adaugă detalii (ex: make it darker, add neon lights)..." 
                            className="flex-1 bg-white/20 border border-white/30 rounded-lg px-3 py-2 text-xs text-white outline-none placeholder:text-white/50" 
                         />
                         <button onClick={() => handleGenerateImage(refinePrompt)} disabled={aeoProcessing} className="bg-purple-600 text-white px-4 rounded-lg text-xs font-bold flex items-center gap-2">
                            {aeoProcessing ? <RefreshCw className="animate-spin" size={14}/> : <Wand2 size={14}/>} Generează
                         </button>
                      </div>
                   </div>
                </div>
              )}

              {/* TAB CONTENT: AEO STUDIO */}
              {editorTab === 'aeo' && (
                <div className="space-y-4 mb-20 animate-in fade-in">
                   {/* STICKY HEADER FOR AEO CONTEXT */}
                   <div className="sticky top-0 bg-white/95 backdrop-blur z-10 p-3 rounded-xl shadow-sm border border-purple-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-800 line-clamp-1 flex-1">{editorData.title || 'Untitled Post'}</span>
                      <span className="text-[10px] text-slate-400 font-mono ml-2">AEO Tools</span>
                   </div>

                   <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100">
                      <h3 className="font-bold text-purple-800 text-sm mb-3 flex items-center gap-2"><Zap size={16}/> Injectoare Inteligente</h3>
                      <div className="grid grid-cols-2 gap-3">
                         <button type="button" onClick={handleInjectSnippet} disabled={aeoProcessing} className="bg-white p-3 rounded-xl text-left border border-purple-100 hover:border-purple-300 shadow-sm active:scale-95 transition-all">
                            <div className="font-bold text-xs text-purple-700 mb-1 flex items-center gap-1"><CheckCircle size={12}/> Answer Target</div>
                            <p className="text-[10px] text-slate-500">Inserează paragraf 40-60 cuvinte la început.</p>
                         </button>
                         <button type="button" onClick={handleInjectTLDR} disabled={aeoProcessing} className="bg-white p-3 rounded-xl text-left border border-purple-100 hover:border-purple-300 shadow-sm active:scale-95 transition-all">
                            <div className="font-bold text-xs text-purple-700 mb-1 flex items-center gap-1"><FileText size={12}/> TL;DR</div>
                            <p className="text-[10px] text-slate-500">Rezumat + Bullet points.</p>
                         </button>
                         <button type="button" onClick={handleGenerateFAQ} disabled={aeoProcessing} className="bg-white p-3 rounded-xl text-left border border-purple-100 hover:border-purple-300 shadow-sm active:scale-95 transition-all">
                            <div className="font-bold text-xs text-purple-700 mb-1 flex items-center gap-1"><HelpCircle size={12}/> FAQ Generator</div>
                            <p className="text-[10px] text-slate-500">Întrebări + Schema JSON-LD.</p>
                         </button>
                         <button type="button" onClick={handleCleanHTML} disabled={aeoProcessing} className="bg-white p-3 rounded-xl text-left border border-purple-100 hover:border-purple-300 shadow-sm active:scale-95 transition-all">
                            <div className="font-bold text-xs text-purple-700 mb-1 flex items-center gap-1"><Eraser size={12}/> Clean HTML</div>
                            <p className="text-[10px] text-slate-500">Curăță tag-uri goale și stiluri.</p>
                         </button>
                         <button type="button" onClick={handleLinkBuilding} disabled={aeoProcessing} className="bg-white p-3 rounded-xl text-left border border-purple-100 hover:border-purple-300 shadow-sm active:scale-95 transition-all flex flex-col justify-center relative">
                            <div className="font-bold text-xs text-purple-700 mb-1 flex items-center gap-1"><Link size={12}/> Link Building</div>
                            <p className="text-[10px] text-slate-500">Link-uri interne.</p>
                            {/* Link Badge */}
                            <span className="absolute top-2 right-2 bg-purple-100 text-purple-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-purple-200">
                               {project.posts.filter(p => p.status === 'publish' && p.id !== editorData.id).length}
                            </span>
                         </button>
                      </div>
                   </div>

                   {/* AI ART STUDIO */}
                   <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                      <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2"><ImageIcon size={16}/> AI Art Studio</h3>
                      <div className="space-y-4">
                         {/* Aspect Ratio Selector */}
                         <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Aspect Ratio</label>
                            <div className="flex gap-2">
                               <button type="button" onClick={() => setImgOptions({...imgOptions, aspectRatio: '16:9'})} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${imgOptions.aspectRatio === '16:9' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}>16:9 (Landscape)</button>
                               <button type="button" onClick={() => setImgOptions({...imgOptions, aspectRatio: '1:1'})} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${imgOptions.aspectRatio === '1:1' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}>1:1 (Square)</button>
                            </div>
                         </div>
                         
                         {/* Style Selector */}
                         <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Stil Imagine</label>
                            <div className="grid grid-cols-2 gap-2">
                               {['realistic', 'minimalist', '3d-render', 'illustration'].map((style) => (
                                  <button 
                                    key={style}
                                    type="button" 
                                    onClick={() => setImgOptions({...imgOptions, style: style as any})} 
                                    className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all capitalize ${imgOptions.style === style ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-white text-slate-600 border-slate-200'}`}
                                  >
                                    {style}
                                  </button>
                               ))}
                            </div>
                         </div>

                         <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Text Overlay</label>
                            <input value={imgOptions.textOverlay || ''} onChange={e => setImgOptions({...imgOptions, textOverlay: e.target.value})} className="w-full text-xs border border-slate-200 rounded-lg p-2 outline-none focus:border-purple-300" placeholder="Titlu pe imagine (Opțional)" />
                         </div>

                         <button type="button" onClick={() => handleGenerateImage()} disabled={aeoProcessing} className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-transform">
                            {aeoProcessing ? <RefreshCw className="animate-spin" size={14}/> : <Wand2 size={14}/>} Generează & Setează Featured Image
                         </button>
                         
                         {generatedPrompt && (
                             <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <p className="text-[10px] text-slate-500 mb-1">Modelul curent nu suportă generarea directă. Copiază promptul:</p>
                                <div className="text-xs font-mono bg-white p-2 rounded border border-slate-200 mb-1">{generatedPrompt}</div>
                                <button type="button" onClick={() => navigator.clipboard.writeText(generatedPrompt)} className="text-xs text-blue-600 font-bold flex items-center gap-1"><Copy size={12}/> Copiază</button>
                             </div>
                         )}
                      </div>
                   </div>

                   {/* AUDIT SECTION */}
                   <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                      <div className="flex justify-between items-center mb-4">
                         <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><Activity size={16}/> SEO Audit</h3>
                         <button type="button" onClick={handleAuditSEO} disabled={aeoProcessing} className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-2">
                             {aeoProcessing && <RefreshCw className="animate-spin" size={12}/>} Rulează Audit
                         </button>
                      </div>
                      
                      {aeoAudit ? (
                         <div className="space-y-3">
                            <div className="flex items-center gap-4">
                               <div className={`text-2xl font-bold ${aeoAudit.score >= 80 ? 'text-green-500' : aeoAudit.score >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{aeoAudit.score}/100</div>
                               <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div className={`h-full ${aeoAudit.score >= 80 ? 'bg-green-500' : aeoAudit.score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{width: `${aeoAudit.score}%`}} />
                               </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-xs">
                               <div className={`p-2 rounded border flex flex-col justify-between gap-2 ${aeoAudit.checklist.hasAnswerParagraph ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                  <span className="font-bold">Answer Snippet</span>
                                  {aeoAudit.checklist.hasAnswerParagraph ? <CheckCircle size={16}/> : (
                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleInjectSnippet(); }} disabled={aeoProcessing} className="bg-white/50 hover:bg-white text-red-700 border border-red-200 px-2 py-1 rounded text-[10px] font-bold w-full text-center">Fix It</button>
                                  )}
                               </div>
                               <div className={`p-2 rounded border flex flex-col justify-between gap-2 ${aeoAudit.checklist.hasTLDR ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                  <span className="font-bold">TL;DR</span>
                                  {aeoAudit.checklist.hasTLDR ? <CheckCircle size={16}/> : (
                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleInjectTLDR(); }} disabled={aeoProcessing} className="bg-white/50 hover:bg-white text-red-700 border border-red-200 px-2 py-1 rounded text-[10px] font-bold w-full text-center">Fix It</button>
                                  )}
                               </div>
                               <div className={`p-2 rounded border flex flex-col justify-between gap-2 ${aeoAudit.checklist.hasFAQ ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                  <span className="font-bold">FAQ Schema</span>
                                  {aeoAudit.checklist.hasFAQ ? <CheckCircle size={16}/> : (
                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleGenerateFAQ(); }} disabled={aeoProcessing} className="bg-white/50 hover:bg-white text-red-700 border border-red-200 px-2 py-1 rounded text-[10px] font-bold w-full text-center">Fix It</button>
                                  )}
                               </div>
                               <div className="p-2 rounded border bg-slate-50 border-slate-200 text-slate-600 flex flex-col justify-between gap-2">
                                  <span className="font-bold">Density</span>
                                  <span className="text-[10px]">{aeoAudit.checklist.keywordDensity}</span>
                               </div>
                            </div>

                            {/* Internal Links & Meta Analysis Display */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                               <div className="p-2 rounded border bg-blue-50 border-blue-100 text-blue-700 flex flex-col justify-between gap-1">
                                  <span className="font-bold">Internal Links</span>
                                  <span className="text-lg font-bold">{aeoAudit.internalLinksCount ?? 0}</span>
                               </div>
                               <div className="p-2 rounded border bg-amber-50 border-amber-100 text-amber-800 flex flex-col justify-between gap-1">
                                  <span className="font-bold">Meta Quality</span>
                                  <span className="text-[9px] leading-tight">{aeoAudit.metaAnalysis || 'N/A'}</span>
                               </div>
                            </div>

                            <div>
                               <p className="text-xs font-bold text-slate-500 mb-1">Sugestii:</p>
                               <ul className="list-disc pl-4 text-xs text-slate-600 space-y-1">
                                  {aeoAudit.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                               </ul>
                            </div>
                         </div>
                      ) : (
                         <p className="text-xs text-slate-400 text-center py-4">Apasă "Rulează Audit" pentru analiză.</p>
                      )}
                   </div>
                </div>
              )}

              {/* Taxonomies (Only in Edit Mode) */}
              {editorTab === 'edit' && (
                <>
                  {/* CATEGORIES */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-4">
                     <button type="button" onClick={() => setIsTaxonomyOpen(!isTaxonomyOpen)} className="w-full p-4 flex justify-between bg-slate-50"><div className="flex gap-2 font-bold text-sm text-slate-700"><Folder size={16}/> Categorii</div>{isTaxonomyOpen?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</button>
                     {isTaxonomyOpen && (
                        <div className="p-5 space-y-4 border-t border-slate-100">
                           <input 
                              type="text" 
                              placeholder="Caută categorie..." 
                              value={catSearch}
                              onChange={(e) => setCatSearch(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-100 mb-2"
                           />
                           <div className="max-h-32 overflow-y-auto p-1 flex flex-wrap gap-2">
                             {project.categories
                                .filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()))
                                .map(c => {
                                  const isSelected = editorData.categories.includes(c.id);
                                  return (
                                    <button 
                                      type="button"
                                      key={c.id} 
                                      onClick={() => setEditorData(p => ({...p, categories: isSelected ? p.categories.filter(x => x!==c.id) : [...p.categories, c.id]}))} 
                                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${isSelected ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}
                                    >
                                      {c.name}
                                    </button>
                                  );
                                })
                             }
                             {project.categories.length === 0 && <p className="text-xs text-slate-400 w-full text-center">Nicio categorie.</p>}
                           </div>
                           <div className="flex gap-2 pt-2 border-t border-slate-50">
                             <input value={newCatName} onChange={e=>setNewCatName(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-100" placeholder="Adaugă nouă..." />
                             <button type="button" onClick={() => handleCreateTax('cat')} className="bg-slate-800 text-white px-3 rounded-lg text-xs font-bold"><Plus size={14}/></button>
                           </div>
                        </div>
                     )}
                  </div>

                  {/* TAGS */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-4">
                     <button type="button" onClick={() => setIsTagOpen(!isTagOpen)} className="w-full p-4 flex justify-between bg-slate-50"><div className="flex gap-2 font-bold text-sm text-slate-700"><Tags size={16}/> Etichete (Tags)</div>{isTagOpen?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</button>
                     {isTagOpen && (
                        <div className="p-5 space-y-4 border-t border-slate-100">
                           <input 
                              type="text" 
                              placeholder="Caută etichetă..." 
                              value={tagSearch}
                              onChange={(e) => setTagSearch(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-100 mb-2"
                           />
                           <div className="max-h-32 overflow-y-auto p-1 flex flex-wrap gap-2">
                             {project.tags
                                .filter(t => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
                                .map(t => {
                                  const isSelected = editorData.tags.includes(t.id);
                                  return (
                                    <button 
                                      type="button"
                                      key={t.id} 
                                      onClick={() => setEditorData(p => ({...p, tags: isSelected ? p.tags.filter(x => x!==t.id) : [...p.tags, t.id]}))} 
                                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${isSelected ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                                    >
                                      {t.name}
                                    </button>
                                  );
                                })
                             }
                             {project.tags.length === 0 && <p className="text-xs text-slate-400 w-full text-center">Nicio etichetă.</p>}
                           </div>
                           <div className="flex gap-2 pt-2 border-t border-slate-50">
                             <input value={newTagName} onChange={e=>setNewTagName(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-100" placeholder="Adaugă nouă..." />
                             <button type="button" onClick={() => handleCreateTax('tag')} className="bg-slate-800 text-white px-3 rounded-lg text-xs font-bold"><Plus size={14}/></button>
                           </div>
                        </div>
                     )}
                  </div>
                </>
              )}
              
              {/* SEO (Only in Edit Mode) */}
              {editorTab === 'edit' && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-20">
                   <button type="button" onClick={() => setIsSeoOpen(!isSeoOpen)} className="w-full p-4 flex justify-between bg-slate-50"><div className="flex gap-2 font-bold text-sm text-slate-700"><Search size={16}/> SEO</div>{isSeoOpen?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</button>
                   {isSeoOpen && (
                      <div className="p-5 space-y-3 border-t border-slate-100">
                         <input value={editorData.seoFocusKw} onChange={e=>setEditorData({...editorData, seoFocusKw:e.target.value})} className="w-full border border-slate-200 rounded-lg p-3 text-xs outline-none focus:ring-2 focus:ring-blue-100" placeholder="Focus Keyword" />
                         
                         <div className="flex gap-2">
                             <input value={editorData.seoTitle} onChange={e=>setEditorData({...editorData, seoTitle:e.target.value})} className="flex-1 border border-slate-200 rounded-lg p-3 text-xs outline-none focus:ring-2 focus:ring-blue-100" placeholder="SEO Title" />
                             <button type="button" onClick={handleAutoGenerateSEO} disabled={aeoProcessing} className="bg-purple-100 text-purple-600 p-2 rounded-lg" title="Generează Auto cu AI"><Wand2 size={16}/></button>
                         </div>
                         
                         <textarea value={editorData.seoDesc} onChange={e=>setEditorData({...editorData, seoDesc:e.target.value})} className="w-full border border-slate-200 rounded-lg p-3 text-xs h-20 resize-none outline-none focus:ring-2 focus:ring-blue-100" placeholder="Meta Description" />
                      </div>
                   )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="fixed bottom-16 md:bottom-4 left-0 right-0 md:left-64 z-40 bg-white/90 backdrop-blur border-t border-slate-200 p-4 flex gap-3">
                 <button type="button" onClick={() => handleSavePost('draft')} disabled={processing} className="flex-1 bg-white border border-slate-200 py-3 rounded-xl font-bold text-sm flex justify-center items-center gap-2 shadow-sm active:scale-95 transition-transform">{processing?<RefreshCw className="animate-spin" size={16}/>:<Save size={16}/>} Draft</button>
                 <button type="button" onClick={() => handleSavePost('publish')} disabled={processing} className="flex-1 bg-gradient-to-r from-indigo-500 to-blue-600 text-white py-3 rounded-xl font-bold text-sm flex justify-center items-center gap-2 shadow-lg shadow-blue-200 active:scale-95 transition-transform">{processing?<RefreshCw className="animate-spin" size={16}/>:<Send size={16}/>} Publică</button>
              </div>
           </div>
        )}
      </div>
    </div>
  );
};
