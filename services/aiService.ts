
import { GoogleGenAI } from "@google/genai";
import { AIArticleData, AIProvider, AEOAuditResult, FAQResult, ClusterTopic, GeoSettings, ImageGenOptions } from "../types";

// Configuration State
let currentConfig = {
  provider: 'google' as AIProvider,
  apiKey: process.env.API_KEY || '',
  model: 'gemini-2.5-flash',
  baseUrl: ''
};

export const configureAI = (provider: AIProvider, apiKey: string, model: string, baseUrl?: string) => {
  currentConfig.provider = provider;
  currentConfig.apiKey = apiKey;
  currentConfig.model = model;
  currentConfig.baseUrl = baseUrl || '';
};

// --- HELPER: JSON PARSER ---
const parseAIResponse = (text: string): any => {
  try {
    // 1. Try direct parse
    return JSON.parse(text);
  } catch (e) {
    // 2. Try cleaning Markdown code blocks
    try {
      const cleanText = text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      return JSON.parse(cleanText);
    } catch (e2) {
      // 3. Last resort: Find first { and last }
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
         try {
           return JSON.parse(text.substring(firstBrace, lastBrace + 1));
         } catch (e3) {
            throw new Error("Could not parse AI response as JSON.");
         }
      }
      throw new Error("Invalid JSON format from AI.");
    }
  }
};

// --- PROVIDER IMPLEMENTATIONS ---

const callGoogle = async (prompt: string, isJson = true): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: currentConfig.apiKey });
  const response = await ai.models.generateContent({
    model: currentConfig.model,
    contents: prompt,
    config: {
      responseMimeType: isJson ? 'application/json' : 'text/plain'
    }
  });
  return response.text || '';
};

const callOpenAICompatible = async (prompt: string, isJson = true): Promise<string> => {
  let url = currentConfig.baseUrl;
  if (!url) {
    if (currentConfig.provider === 'deepseek') url = 'https://api.deepseek.com';
    else url = 'https://api.openai.com/v1';
  }
  if (url.endsWith('/')) url = url.slice(0, -1);
  const endpoint = `${url}/chat/completions`;

  const messages = [
    { role: "system", content: "You are a helpful assistant that returns strict JSON." },
    { role: "user", content: prompt }
  ];

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentConfig.apiKey}`
    },
    body: JSON.stringify({
      model: currentConfig.model,
      messages: messages,
      response_format: isJson ? { type: "json_object" } : undefined,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI Provider Error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
};

const callAnthropic = async (prompt: string, isJson = true): Promise<string> => {
  const url = 'https://api.anthropic.com/v1/messages';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': currentConfig.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: currentConfig.model,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic Error: ${err}`);
  }

  const data = await response.json();
  const text = data.content[0].text;
  return text;
};

const runAI = async (prompt: string, isJson = true): Promise<string> => {
  if (!currentConfig.apiKey) throw new Error("API Key lipsă. Configurează AI din profil.");
  
  switch (currentConfig.provider) {
    case 'google': return callGoogle(prompt, isJson);
    case 'openai': 
    case 'deepseek': return callOpenAICompatible(prompt, isJson);
    case 'anthropic': return callAnthropic(prompt, isJson);
    default: return callGoogle(prompt, isJson);
  }
};

// --- FEATURES ---

export const generateKeywords = async (niche: string, count: number, details: string, geo?: GeoSettings): Promise<string[]> => {
  const geoPrompt = geo?.city ? `Local SEO focus for: ${geo.city}, ${geo.country}.` : '';
  const prompt = `
    Generate a JSON list of exactly ${count} SEO keyword ideas for the niche: "${niche}".
    ${details ? `Additional context: ${details}` : ''}
    ${geoPrompt}
    Return ONLY a JSON array of strings. Example: ["keyword 1", "keyword 2"]
  `;
  const res = await runAI(prompt);
  const parsed = parseAIResponse(res);
  // Robustness check
  if (Array.isArray(parsed)) return parsed;
  if (parsed.keywords && Array.isArray(parsed.keywords)) return parsed.keywords;
  return [];
};

export const generateClusterTopics = async (niche: string, geo?: GeoSettings): Promise<string[]> => {
  const geoPrompt = geo?.city ? `Local SEO context: ${geo.city}, ${geo.country}.` : '';
  const prompt = `
    Act as an SEO Topical Authority Expert.
    Create a Topic Cluster for: "${niche}".
    ${geoPrompt}
    Return a strict JSON array of strings where the first item is the Pillar Page Topic, and the next 9 are Sub-topics/Supporting Articles.
    Total 10 items.
  `;
  const res = await runAI(prompt);
  const parsed = parseAIResponse(res);
  if (Array.isArray(parsed)) return parsed;
  if (parsed.topics && Array.isArray(parsed.topics)) return parsed.topics;
  return [];
};

export const generateEditorialStrategy = async (keywords: string[]): Promise<any[]> => {
  const prompt = `
    Act as a Senior Content Strategist.
    Input Keywords: ${JSON.stringify(keywords)}
    
    For each keyword, create an editorial plan item containing:
    1. "title": A click-worthy, SEO-optimized title (H1).
    2. "slug": A short, SEO-friendly URL slug.
    3. "suggestedDate": A suggested publish date (YYYY-MM-DD), spaced out every 2 days starting from tomorrow.
    
    Return a strict JSON ARRAY of objects. 
    Structure: [{ "keyword": "...", "title": "...", "slug": "...", "suggestedDate": "..." }]
  `;
  const res = await runAI(prompt);
  const parsed = parseAIResponse(res);
  
  // Robustness: Handle if AI wraps array in an object key like { "plan": [...] }
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === 'object' && parsed !== null) {
     // Search for the first array property
     const keys = Object.keys(parsed);
     for (const key of keys) {
       if (Array.isArray(parsed[key])) return parsed[key];
     }
  }
  
  throw new Error("Invalid format from AI Strategy. Expected Array.");
};

export const generateFullArticle = async (keyword: string, context?: string): Promise<AIArticleData> => {
  const prompt = `
    Write a comprehensive, SEO-optimized blog article for the keyword: "${keyword}".
    ${context ? `Context/Constraints: ${context}` : ''}
    
    Requirements:
    - Language: Romanian.
    - Format: Semantic HTML (use h2, h3, p, ul, li).
    - SEO: Include the keyword naturally in the first 100 words and headers.
    - Title: Generate a compelling H1 title that includes the keyword.
    
    Output JSON structure:
    {
      "title": "Optimized H1 Title",
      "slug": "url-slug",
      "content": "<article>...html content...</article>",
      "excerpt": "Short summary (150 chars)",
      "seoTitle": "Meta Title (max 60 chars) including keyword",
      "seoDesc": "Meta Description (max 160 chars) including keyword",
      "focusKw": "${keyword}",
      "suggestedTags": ["tag1", "tag2"]
    }
  `;
  const res = await runAI(prompt);
  return parseAIResponse(res);
};

// --- AEO & GEO FEATURES ---

export const generateAnswerParagraph = async (content: string): Promise<string> => {
  const prompt = `
    Analyze the following content topic: "${content.substring(0, 500)}...".
    Generate a "Direct Answer" paragraph (40-60 words) optimized for Answer Engines (Google SGE, Perplexity).
    It should directly answer the implicit user intent of the topic.
    Format it as a distinct HTML block using a div with inline styles: 
    border: 3px solid #3b82f6; background-color: #eff6ff; padding: 24px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); font-family: sans-serif;
    Start the block with <strong style="display:block; margin-bottom:12px; color:#1e40af; font-size:1.2em;">Quick Answer:</strong>
    Return ONLY the HTML string of this block.
  `;
  const res = await runAI(prompt, false); 
  const jsonPrompt = `
    ${prompt}
    Return JSON: { "html": "..." }
  `;
  try {
    const json = await runAI(jsonPrompt);
    return parseAIResponse(json).html;
  } catch (e) {
    return await runAI(prompt, false);
  }
};

export const generateTLDR = async (content: string): Promise<string> => {
  const prompt = `
    Read this content: "${content.substring(0, 3000)}...".
    Generate a TL;DR section.
    1. One sentence summary (bold).
    2. A bulleted list of 3-5 key takeaways.
    Format as HTML using a <div style="background:#f0fdf4; padding:16px; border-radius:8px; margin-bottom:20px; border:1px solid #bbf7d0;">.
    Title it "TL;DR - Rezumat" in H3.
    Return JSON: { "html": "..." }
  `;
  const res = await runAI(prompt);
  return parseAIResponse(res).html;
};

export const generateFAQSchema = async (content: string): Promise<FAQResult> => {
  const prompt = `
    Analyze content: "${content.substring(0, 5000)}...".
    Generate 3-4 distinct Frequently Asked Questions based on the content.
    
    Output JSON with two fields:
    1. "html": A semantic HTML <section> with <h3>Frequently Asked Questions</h3> and <details><summary>Q</summary>A</details> tags.
    2. "jsonLD": A valid JSON-LD object for "FAQPage" Schema.org. 
    IMPORTANT: Return ONLY the raw JSON object for the schema. DO NOT wrap it in <script> tags. DO NOT wrap it in markdown code blocks. The UI will wrap it.
    
    Ensure questions are not already present in the content.
  `;
  const res = await runAI(prompt);
  return parseAIResponse(res);
};

export const cleanHTML = async (html: string, keyword?: string): Promise<string> => {
  const prompt = `
    Act as an SEO Code Expert. Clean and Optimize the following HTML content:
    "${html.substring(0, 50000)}"
    
    Tasks:
    1. **H1 Enforcement**: The content MUST start with an <h1> tag. If one exists, ensure it contains the keyword "${keyword || 'Topic'}". If not, CREATE one at the very top. Remove any other H1 tags. There must be exactly one H1, and it must be the first element.
    2. **Schema Cleaning**: Look for JSON-LD scripts. Ensure they are NOT nested inside other script tags. Flatten them to be valid.
    3. **Deduplication**: Remove duplicate FAQ schemas or visible FAQ sections.
    4. **SEO Preservation**: DO NOT remove paragraphs or headings that contain the keyword "${keyword}".
    5. **Cleanup**: Remove empty tags (<p></p>), inline style attributes (except the Answer Snippet styles).
    
    Return JSON: { "cleanedHtml": "..." }
  `;
  const res = await runAI(prompt);
  return parseAIResponse(res).cleanedHtml;
};

export const auditSEOContent = async (html: string, keyword: string, seoTitle: string, seoDesc: string): Promise<AEOAuditResult> => {
  const prompt = `
    Perform a strict AEO & SEO Audit on this content.
    Target Keyword: "${keyword}"
    SEO Title: "${seoTitle}"
    Meta Desc: "${seoDesc}"
    Content: "${html.substring(0, 50000)}"
    
    Tasks:
    1. Check for **Answer Snippet** (definition/answer block at start).
    2. Check for **TL;DR** section.
    3. Check for **FAQ** section and valid Schema.
    4. Verify **H1 Structure**: Does it start with H1? Does H1 have the keyword?
    5. **Internal Links**: Count the number of internal hyperlinks (<a href="...">) in the content.
    6. **Metadata**: 
       - Is SEO Title present and does it include the keyword? 
       - Is Meta Desc 120-160 chars and includes keyword?
    
    Return JSON:
    {
      "score": number (0-100),
      "internalLinksCount": number,
      "metaAnalysis": "Short string evaluating Title/Meta quality (e.g., 'Title missing keyword, Desc too short')",
      "checklist": {
        "hasAnswerParagraph": boolean,
        "hasTLDR": boolean,
        "hasFAQ": boolean,
        "structureScore": number,
        "keywordDensity": "string assessment (e.g. 'Natural', 'Stuffed')"
      },
      "suggestions": ["string1", "string2"]
    }
  `;
  const res = await runAI(prompt);
  return parseAIResponse(res);
};

export const generateSEOMetadata = async (content: string, keyword: string): Promise<{seoTitle: string, seoDesc: string}> => {
  const prompt = `
    Generate SEO Metadata for content related to keyword: "${keyword}".
    Content Sample: "${content.substring(0, 2000)}..."
    
    Requirements:
    1. **SEO Title**: 50-60 characters. Must include "${keyword}" at the beginning. Engaging, high CTR.
    2. **Meta Description**: 120-160 characters. Must include "${keyword}". Summarize value proposition. Actionable.
    
    Return JSON: { "seoTitle": "...", "seoDesc": "..." }
  `;
  const res = await runAI(prompt);
  return parseAIResponse(res);
};

// --- IMAGE GENERATION ---

export const generateFeaturedImage = async (articleTitle: string, articleContent: string, options: ImageGenOptions): Promise<{ base64?: string; prompt?: string }> => {
  if (!currentConfig.apiKey) throw new Error("API Key lipsă. Configurează AI din profil.");

  // Construct a prompt optimized for "Nano Banana" (Gemini Image models)
  const imagePrompt = `
    Generate a high-quality, photorealistic featured image for a blog article titled "${articleTitle}".
    Topic Context: ${articleContent.substring(0, 200)}.
    Style: ${options.style || 'realistic, cinematic lighting'}.
    ${options.textOverlay ? `Text Requirement: The image MUST clearly display the text: "${options.textOverlay}" in a modern font.` : ''}
    ${options.brandingColors ? `Color Palette: Dominant colors should be ${options.brandingColors}.` : ''}
    Aspect Ratio: ${options.aspectRatio || '16:9'}.
    No blurry text, no distorted faces. High resolution, blog-ready.
  `;

  // Use the appropriate model based on availability or settings
  const modelName = 'gemini-2.5-flash-image'; 

  try {
    if (currentConfig.provider === 'google') {
        const ai = new GoogleGenAI({ apiKey: currentConfig.apiKey });
        
        // Using generateContent with specific image generation request structure
        const response = await ai.models.generateContent({
            model: modelName,
            contents: {
              parts: [{ text: imagePrompt }]
            }
        });

        // Parse response to find image part
        if (response.candidates && response.candidates[0].content.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
               return { base64: part.inlineData.data };
            }
          }
        }
    }
  } catch (e) {
    console.warn("Image generation error, attempting fallback prompt:", e);
  }

  // Fallback: If direct generation fails (or using other provider), return a refined prompt
  const fallbackPromptReq = `
    Act as a Prompt Engineer. Write a detailed image generation prompt for: "${articleTitle}".
    Style: ${options.style}.
    Return ONLY the prompt string.
  `;
  const promptRes = await runAI(fallbackPromptReq, false);
  return { prompt: promptRes };
};

// --- INTERNAL LINK BUILDING ---

export const generateInternalLinks = async (content: string, existingPosts: { title: string, link: string }[]): Promise<string> => {
  // We limit the context to avoid token limits. Sending just title and link is efficient.
  const postsContext = existingPosts.map(p => `- Title: "${p.title}", Link: "${p.link}"`).join('\n');
  
  const prompt = `
    Act as an SEO Specialist. You are tasked with Internal Link Building.
    
    Current Content:
    "${content.substring(0, 50000)}"
    
    Existing Blog Posts (Targets for internal linking):
    ${postsContext}
    
    Instructions:
    1. **Semantic Matching**: Scan the "Current Content" for concepts, synonyms, or phrases that match the topics of the "Existing Blog Posts". Do NOT rely solely on exact title matches.
    2. **Natural Integration**: Create links that flow naturally within the sentence structure. Use existing words as anchor text whenever possible.
    3. **Rules**: 
       - Do NOT change the meaning of the text.
       - Do NOT force links where they don't belong.
       - Max 1 link per target URL.
       - Limit total new links to 3-5 most relevant ones.
    4. Return JSON: { "linkedContent": "..." } containing the full HTML with new links embedded.
  `;

  const res = await runAI(prompt);
  return parseAIResponse(res).linkedContent;
};
