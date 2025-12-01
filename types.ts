
export interface WPCredentials {
  url: string;
  username: string;
  appPassword: string;
}

export interface WPCategory {
  id: number;
  count: number;
  description: string;
  link: string;
  name: string;
  slug: string;
  parent: number;
}

export interface WPTag {
  id: number;
  count: number;
  description: string;
  link: string;
  name: string;
  slug: string;
}

export interface WPPost {
  id: number;
  date: string;
  modified: string;
  status: 'publish' | 'draft' | 'future' | 'trash';
  title: {
    rendered: string;
    raw?: string;
  };
  content: {
    rendered: string;
    raw?: string;
  };
  excerpt: {
    rendered: string;
    raw?: string;
  };
  link: string;
  categories?: number[];
  tags?: number[];
  featured_media?: number; // Added field
  // SEO fields simulation (meta)
  meta?: {
    _yoast_wpseo_title?: string;
    _yoast_wpseo_metadesc?: string;
    _yoast_wpseo_focuskw?: string;
    [key: string]: any;
  };
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface Project {
  id: string;
  name: string;
  createdAt: Date;
  type: 'project' | 'folder';
  // Specific data per project
  credentials: WPCredentials;
  status: ConnectionStatus;
  lastErrorMessage?: string; // New field for detailed errors
  posts: WPPost[];
  categories: WPCategory[];
  tags: WPTag[];
  lastSync?: Date;
}

export type ViewState = 'home' | 'projects' | 'planner' | 'profile';
export type PlannerView = 'menu' | 'keywords' | 'folder'; 

export interface AIArticleData {
  title: string;
  slug: string;
  content: string; // HTML format
  excerpt: string;
  seoTitle: string;
  seoDesc: string;
  focusKw: string;
  suggestedTags: string[];
}

export interface UserProfile {
  name: string;
  role: string;
  avatarUrl: string;
  email: string;
}

export type AIProvider = 'google' | 'openai' | 'deepseek' | 'anthropic';

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl?: string; // For OpenAI compatible APIs (like DeepSeek or LocalAI)
}

export interface SavedKeyword {
  id: string;
  term: string;
  addedAt: Date;
}

// --- NEW STRATEGY TYPES ---

export interface PlanItem {
  id: string;
  keyword: string; // The source keyword
  title: string;
  slug: string;
  suggestedDate: string; // ISO Date String
  status: 'planned' | 'generated' | 'published';
  generatedContent?: AIArticleData; // Populated after Phase 2
}

export interface PlannerFolder {
  id: string;
  name: string;
  createdAt: Date;
  keywords: SavedKeyword[];
  planItems: PlanItem[]; // The Editorial Calendar
}

// --- AEO & GEO TYPES ---

export interface GeoSettings {
  city?: string;
  country?: string;
}

export interface AEOAuditResult {
  score: number;
  internalLinksCount?: number; // New metric
  metaAnalysis?: string; // New metric
  checklist: {
    hasAnswerParagraph: boolean;
    hasTLDR: boolean;
    hasFAQ: boolean;
    structureScore: number;
    keywordDensity: string;
  };
  suggestions: string[];
}

export interface FAQResult {
  html: string; // The visible list
  jsonLD: string; // The <script> tag content
}

export interface ClusterTopic {
  mainTopic: string;
  subTopics: string[];
}

// --- IMAGE GENERATION TYPES ---

export interface WPImage {
  id: number;
  source_url: string;
  alt_text: string;
}

export interface ImageGenOptions {
  style: 'realistic' | 'minimalist' | '3d-render' | 'illustration';
  textOverlay?: string;
  brandingColors?: string;
  aspectRatio?: '16:9' | '1:1';
}

export interface MediaUploadResponse {
  id: number;
  source_url: string;
}
