
import { WPCredentials, WPPost, WPCategory, WPTag, MediaUploadResponse } from '../types';

export const validateUrl = (url: string): string => {
  let cleanUrl = url.trim();
  
  // Remove trailing slash(es)
  cleanUrl = cleanUrl.replace(/\/+$/, '');

  // If no protocol is provided, infer it
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    const isLocal = cleanUrl.includes('localhost') || 
                    cleanUrl.includes('127.0.0.1') || 
                    cleanUrl.match(/^192\.168\./) ||
                    cleanUrl.match(/^10\./);
    
    return isLocal ? `http://${cleanUrl}` : `https://${cleanUrl}`;
  }

  // If protocol is explicitly provided (http or https), respect it.
  // This allows users to connect to non-SSL sites if needed.
  return cleanUrl;
};

const getAuthHeaders = (creds: WPCredentials): Headers => {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  
  if (creds.username && creds.appPassword) {
    // Always clean Application Password (spaces are often added for readability)
    const password = creds.appPassword.replace(/\s+/g, '');

    // Safe Base64 Encoding for UTF-8
    const safeBase64 = btoa(unescape(encodeURIComponent(`${creds.username}:${password}`)));
    headers.set('Authorization', 'Basic ' + safeBase64);
  }
  return headers;
};

export const checkConnection = async (creds: WPCredentials): Promise<{ success: boolean; error?: string }> => {
  const baseUrl = validateUrl(creds.url);
  const headers = getAuthHeaders(creds);
  
  try {
    const response = await fetch(`${baseUrl}/wp-json/wp/v2/users/me`, {
      method: 'GET',
      headers: headers,
    });
    
    if (response.ok) {
      return { success: true };
    } else {
      let msg = `HTTP Error: ${response.status}`;
      if (response.status === 401) msg = "401 Unauthorized: Verifică user/parolă.";
      if (response.status === 403) msg = "403 Forbidden: Serverul a refuzat accesul.";
      if (response.status === 404) msg = "404 Not Found: URL-ul nu pare să fie un site WordPress valid.";
      return { success: false, error: msg };
    }
  } catch (error: any) {
    console.error("Connection check failed:", error);
    // Handle typical fetch errors (Network or CORS)
    const isNetworkError = error.message === 'Failed to fetch' || error.name === 'TypeError';
    const msg = isNetworkError 
      ? 'Eroare de rețea sau CORS. Verifică URL-ul și dacă site-ul permite REST API.'
      : (error.message || 'Network Error');
    return { success: false, error: msg };
  }
};

export const fetchPosts = async (creds: WPCredentials): Promise<WPPost[]> => {
  const baseUrl = validateUrl(creds.url);
  const headers = getAuthHeaders(creds);
  
  try {
    const response = await fetch(`${baseUrl}/wp-json/wp/v2/posts?per_page=50&status=any&context=edit`, {
      method: 'GET',
      headers: headers,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data as WPPost[];
  } catch (error) {
    console.error("Fetch posts failed:", error);
    throw error;
  }
};

// --- CATEGORIES ---

export const fetchCategories = async (creds: WPCredentials): Promise<WPCategory[]> => {
  const baseUrl = validateUrl(creds.url);
  const headers = getAuthHeaders(creds);
  try {
    const response = await fetch(`${baseUrl}/wp-json/wp/v2/categories?per_page=100&hide_empty=false`, { headers });
    if (!response.ok) throw new Error('Failed to fetch categories');
    return await response.json();
  } catch (error) {
    console.error("Fetch categories failed:", error);
    return [];
  }
};

export const createCategory = async (creds: WPCredentials, name: string): Promise<WPCategory> => {
  const baseUrl = validateUrl(creds.url);
  const headers = getAuthHeaders(creds);
  try {
    const response = await fetch(`${baseUrl}/wp-json/wp/v2/categories`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name })
    });

    if (!response.ok) {
      let errData: any = {};
      try {
        errData = await response.json();
      } catch (e) {
        // If response is not JSON
      }
      
      if (response.status === 401 || response.status === 403 || errData.code === 'rest_cannot_create') {
        throw new Error('PERMISSION_DENIED');
      }

      if (errData.code === 'term_exists' && errData.data?.term_id) {
         const existingRes = await fetch(`${baseUrl}/wp-json/wp/v2/categories/${errData.data.term_id}`, { headers });
         if (existingRes.ok) return await existingRes.json();
      }

      throw new Error(errData.message || `API Error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Create category failed:", error);
    throw error;
  }
};

// --- TAGS ---

export const fetchTags = async (creds: WPCredentials): Promise<WPTag[]> => {
  const baseUrl = validateUrl(creds.url);
  const headers = getAuthHeaders(creds);
  try {
    const response = await fetch(`${baseUrl}/wp-json/wp/v2/tags?per_page=100&hide_empty=false`, { headers });
    if (!response.ok) throw new Error('Failed to fetch tags');
    return await response.json();
  } catch (error) {
    console.error("Fetch tags failed:", error);
    return [];
  }
};

export const createTag = async (creds: WPCredentials, name: string): Promise<WPTag> => {
  const baseUrl = validateUrl(creds.url);
  const headers = getAuthHeaders(creds);
  try {
    const response = await fetch(`${baseUrl}/wp-json/wp/v2/tags`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name })
    });

    if (!response.ok) {
      let errData: any = {};
      try {
        errData = await response.json();
      } catch (e) {}
      
      if (response.status === 401 || response.status === 403 || errData.code === 'rest_cannot_create') {
        throw new Error('PERMISSION_DENIED');
      }

      if (errData.code === 'term_exists' && errData.data?.term_id) {
         const existingRes = await fetch(`${baseUrl}/wp-json/wp/v2/tags/${errData.data.term_id}`, { headers });
         if (existingRes.ok) return await existingRes.json();
      }

      throw new Error(errData.message || `API Error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Create tag failed:", error);
    throw error;
  }
};

// --- CRUD POSTS ---

export const createPost = async (creds: WPCredentials, postData: any): Promise<WPPost> => {
  const baseUrl = validateUrl(creds.url);
  const headers = getAuthHeaders(creds);

  try {
    const response = await fetch(`${baseUrl}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(postData)
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create post');
    }
    return await response.json();
  } catch (error) {
    console.error("Create post failed:", error);
    throw error;
  }
};

export const updatePost = async (creds: WPCredentials, postId: number, postData: any): Promise<WPPost> => {
  const baseUrl = validateUrl(creds.url);
  const headers = getAuthHeaders(creds);

  try {
    const response = await fetch(`${baseUrl}/wp-json/wp/v2/posts/${postId}`, {
      method: 'POST', 
      headers: headers,
      body: JSON.stringify(postData)
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update post');
    }
    return await response.json();
  } catch (error) {
    console.error("Update post failed:", error);
    throw error;
  }
};

export const deletePost = async (creds: WPCredentials, postId: number): Promise<boolean> => {
  const baseUrl = validateUrl(creds.url);
  const headers = getAuthHeaders(creds);

  try {
    const response = await fetch(`${baseUrl}/wp-json/wp/v2/posts/${postId}?force=true`, {
      method: 'DELETE',
      headers: headers,
    });

    return response.ok;
  } catch (error) {
    console.error("Delete post failed:", error);
    throw error;
  }
};

// --- MEDIA UPLOAD ---

export const uploadMedia = async (creds: WPCredentials, fileBlob: Blob, fileName: string): Promise<MediaUploadResponse> => {
  const baseUrl = validateUrl(creds.url);
  const headers = getAuthHeaders(creds);
  
  // Important headers for media upload
  headers.set('Content-Disposition', `attachment; filename="${fileName}"`);
  headers.set('Content-Type', fileBlob.type);

  try {
    const response = await fetch(`${baseUrl}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: headers,
      body: fileBlob
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to upload media');
    }
    return await response.json();
  } catch (error) {
    console.error("Upload media failed:", error);
    throw error;
  }
};
