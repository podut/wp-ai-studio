
import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Project, ViewState, UserProfile, AISettings, PlannerFolder, SavedKeyword, PlanItem } from './types';
import { checkConnection, fetchPosts, fetchCategories, fetchTags, createPost } from './services/wpService';
import { generateFullArticle, configureAI, generateEditorialStrategy } from './services/aiService';

// Import Modular View Components
import { HomeView } from './dashboard/pages/HomeView';
import { ProjectListView } from './dashboard/pages/ProjectListView';
import { PlannerView } from './dashboard/pages/PlannerView';
import { ProfileView } from './admin/pages/ProfileView';
import { ActiveProjectView } from './mobile/pages/ActiveProjectView';
import { WelcomeView } from './public/pages/WelcomeView';

export const App: React.FC = () => {
  // Navigation State
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // --- PERSISTENT STATE ---

  // 1. Projects
  const [projects, setProjects] = useState<Project[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem('wp_projects');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((p: any) => ({
          ...p,
          createdAt: new Date(p.createdAt),
          lastSync: p.lastSync ? new Date(p.lastSync) : undefined
        }));
      } catch (e) { return []; }
    }
    return [{ 
      id: '1', name: 'Exemplu Blog', type: 'project', createdAt: new Date(),
      credentials: { url: '', username: '', appPassword: '' },
      status: 'disconnected', posts: [], categories: [], tags: []
    }];
  });

  // 2. Profile
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('wp_user_profile');
    return saved ? JSON.parse(saved) : { name: 'Admin Local', role: 'Content Manager', email: 'admin@wpmanager.app', avatarUrl: '' };
  });

  // 3. AI Settings
  const [aiSettings, setAiSettings] = useState<AISettings>(() => {
    const saved = localStorage.getItem('wp_ai_settings');
    // FIX: Use process.env.API_KEY as default to ensure it's loaded if not saved
    return saved ? JSON.parse(saved) : { provider: 'google', apiKey: process.env.API_KEY || '', model: 'gemini-2.5-flash', baseUrl: '' };
  });

  // 4. Planner Folders
  const [plannerFolders, setPlannerFolders] = useState<PlannerFolder[]>(() => {
    const savedFolders = localStorage.getItem('wp_planner_folders');
    
    // MIGRATION LOGIC
    const oldKeywordsRaw = localStorage.getItem('wp_saved_keywords');
    let migratedFolder: PlannerFolder | null = null;
    
    if (oldKeywordsRaw && !savedFolders) {
      try {
        const parsedOld = JSON.parse(oldKeywordsRaw);
        if (Array.isArray(parsedOld) && parsedOld.length > 0) {
           migratedFolder = {
             id: 'migration-archive',
             name: 'Arhivă Veche',
             createdAt: new Date(),
             keywords: parsedOld.map((k: any) => ({ ...k, addedAt: new Date(k.addedAt || new Date()) })),
             planItems: [] 
           };
        }
        localStorage.removeItem('wp_saved_keywords'); 
      } catch (e) {}
    }

    if (savedFolders) {
      try {
        const parsed = JSON.parse(savedFolders);
        const folders = parsed.map((f: any) => ({
          ...f,
          createdAt: new Date(f.createdAt),
          keywords: f.keywords.map((k: any) => ({ ...k, addedAt: new Date(k.addedAt) })),
          planItems: f.planItems || [] 
        }));
        if (migratedFolder) folders.unshift(migratedFolder);
        return folders;
      } catch (e) { return []; }
    }
    
    return migratedFolder ? [migratedFolder] : [];
  });

  // Loading State
  const [loadingProject, setLoadingProject] = useState<string | null>(null);

  // --- EFFECTS: Persistence ---
  useEffect(() => localStorage.setItem('wp_projects', JSON.stringify(projects)), [projects]);
  useEffect(() => localStorage.setItem('wp_user_profile', JSON.stringify(userProfile)), [userProfile]);
  useEffect(() => localStorage.setItem('wp_ai_settings', JSON.stringify(aiSettings)), [aiSettings]);
  useEffect(() => localStorage.setItem('wp_planner_folders', JSON.stringify(plannerFolders)), [plannerFolders]);

  // --- EFFECT: Init AI ---
  useEffect(() => {
    configureAI(aiSettings.provider, aiSettings.apiKey, aiSettings.model, aiSettings.baseUrl);
  }, [aiSettings]);

  // --- EFFECT: Background Sync (Auto-Refresh) ---
  useEffect(() => {
    const interval = setInterval(() => {
      projects.forEach(p => {
        if (p.status === 'connected') {
           // Silent sync
           handleSyncPosts(p, true);
        }
      });
    }, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [projects]);

  // --- PROJECT HANDLERS ---

  const handleUpdateProject = (id: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const handleAddProject = (name: string) => {
    const newProj: Project = {
      id: Date.now().toString(),
      name,
      type: 'project',
      createdAt: new Date(),
      credentials: { url: '', username: '', appPassword: '' },
      status: 'disconnected',
      posts: [], categories: [], tags: []
    };
    setProjects(prev => [...prev, newProj]);
  };

  const handleSyncPosts = async (project: Project, silent = false) => {
    if (!silent) setLoadingProject(project.id);
    try {
       const posts = await fetchPosts(project.credentials);
       const cats = await fetchCategories(project.credentials);
       const tags = await fetchTags(project.credentials);
       
       handleUpdateProject(project.id, {
         posts, categories: cats, tags,
         status: 'connected',
         lastSync: new Date(),
         lastErrorMessage: undefined
       });
    } catch (e: any) {
       console.error("Sync failed", e);
       // Critical Fix: Mark as error to stop infinite polling loop
       handleUpdateProject(project.id, { 
         status: 'error', 
         lastErrorMessage: e.message 
       });
       if (!silent) {
         // Optionally alert only if it's a manual sync
         // alert(`Sync Error: ${e.message}`);
       }
    } finally {
       if (!silent) setLoadingProject(null);
    }
  };

  const handleConnectProject = async (project: Project) => {
     setLoadingProject(project.id);
     const res = await checkConnection(project.credentials);
     if (res.success) {
        await handleSyncPosts(project, false);
     } else {
        handleUpdateProject(project.id, { 
           status: 'error',
           lastErrorMessage: res.error 
        });
        setLoadingProject(null);
     }
  };

  // --- PLANNER HANDLERS ---

  const handleAddFolder = (name: string, keywords: string[]) => {
    const newFolder: PlannerFolder = {
      id: Date.now().toString(),
      name,
      createdAt: new Date(),
      keywords: keywords.map(k => ({ id: Math.random().toString(36), term: k, addedAt: new Date() })),
      planItems: []
    };
    setPlannerFolders(prev => [newFolder, ...prev]);
  };

  const handleDeleteFolder = (id: string) => {
    setPlannerFolders(prev => prev.filter(f => f.id !== id));
  };

  const handleUpdateFolder = (id: string, name: string) => {
    setPlannerFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
  };

  const handleUpdateFolderKeywords = (folderId: string, keywords: SavedKeyword[]) => {
    setPlannerFolders(prev => prev.map(f => f.id === folderId ? { ...f, keywords } : f));
  };

  const handleCreateStrategy = async (folderId: string, keywords: string[]) => {
    try {
      const strategyItems = await generateEditorialStrategy(keywords);
      
      // Safety Check: Ensure we got an array
      if (!Array.isArray(strategyItems)) {
        throw new Error("Formatul răspunsului AI este invalid (nu este o listă). Încearcă din nou.");
      }

      const newPlanItems: PlanItem[] = strategyItems.map((item: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        keyword: item.keyword || 'Unknown',
        title: item.title || 'Untitled',
        slug: item.slug || 'untitled',
        suggestedDate: item.suggestedDate || new Date().toISOString().split('T')[0],
        status: 'planned'
      }));

      setPlannerFolders(prev => prev.map(f => {
        if (f.id === folderId) {
          return { ...f, planItems: [...(f.planItems || []), ...newPlanItems] };
        }
        return f;
      }));
    } catch (e: any) {
      alert(`Strategy Error: ${e.message}`);
    }
  };

  const handleUpdatePlanItem = (folderId: string, itemId: string, updates: Partial<PlanItem>) => {
    setPlannerFolders(prev => prev.map(f => {
      if (f.id === folderId) {
        return {
          ...f,
          planItems: f.planItems.map(i => i.id === itemId ? { ...i, ...updates } : i)
        };
      }
      return f;
    }));
  };

  const handleGenerateItemContent = async (folderId: string, item: PlanItem) => {
    try {
      const articleData = await generateFullArticle(item.keyword);
      
      const updates: Partial<PlanItem> = {
        status: 'generated',
        generatedContent: articleData,
        title: articleData.title, // Update title with generated one
        slug: articleData.slug
      };

      handleUpdatePlanItem(folderId, item.id, updates);
    } catch (e: any) {
      alert(`Content Gen Error: ${e.message}`);
      throw e;
    }
  };

  const handlePublishPlanItem = async (folderId: string, item: PlanItem, projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project || !item.generatedContent) return;

    try {
      const postData = {
        title: item.generatedContent.title,
        content: item.generatedContent.content, // Should be HTML
        status: 'draft',
        meta: {
           _yoast_wpseo_title: item.generatedContent.seoTitle,
           _yoast_wpseo_metadesc: item.generatedContent.seoDesc,
           _yoast_wpseo_focuskw: item.generatedContent.focusKw
        }
      };
      
      await createPost(project.credentials, postData);
      
      // Update plan item status
      handleUpdatePlanItem(folderId, item.id, { status: 'published' });
      
      // Refresh project posts
      await handleSyncPosts(project, true);
      
    } catch (e: any) {
      alert(`Publish Error: ${e.message}`);
      throw e;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50">
      <Navbar currentView={currentView} onChangeView={setCurrentView} />

      <main className="flex-1 h-full overflow-hidden relative">
        {activeProjectId ? (
          <ActiveProjectView 
             project={projects.find(p => p.id === activeProjectId)!}
             onUpdateProject={handleUpdateProject}
             onClose={() => setActiveProjectId(null)}
             onSync={(p, silent) => handleSyncPosts(p, silent)}
             onConnect={handleConnectProject}
             loadingProjectId={loadingProject}
          />
        ) : (
          <>
            {currentView === 'home' && <HomeView projects={projects} onChangeView={setCurrentView} />}
            {currentView === 'projects' && (
              <ProjectListView 
                projects={projects} 
                onAddProject={handleAddProject}
                onOpenProject={(p) => setActiveProjectId(p.id)}
              />
            )}
            {currentView === 'planner' && (
              <PlannerView 
                projects={projects}
                folders={plannerFolders}
                onAddFolder={handleAddFolder}
                onDeleteFolder={handleDeleteFolder}
                onUpdateFolder={handleUpdateFolder}
                onUpdateFolderKeywords={handleUpdateFolderKeywords}
                onCreateStrategy={handleCreateStrategy}
                onUpdatePlanItem={handleUpdatePlanItem}
                onGenerateItemContent={handleGenerateItemContent}
                onPublishPlanItem={handlePublishPlanItem}
              />
            )}
            {currentView === 'profile' && (
              <ProfileView 
                userProfile={userProfile}
                aiSettings={aiSettings}
                onUpdateProfile={setUserProfile}
                onUpdateAISettings={setAiSettings}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
};
