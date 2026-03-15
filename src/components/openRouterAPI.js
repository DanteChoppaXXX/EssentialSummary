// openRouterAPI.js - OpenRouter API integration for PDF summarization

/**
 * OpenRouter API Configuration
 * Get your free API key from: https://openrouter.ai/keys
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Available models on OpenRouter
export const OPENROUTER_MODELS = {
  // Meta Llama 3 8B - Free and reliable
  LLAMA_3_1_8B: 'meta-llama/llama-3.1-8b-instruct',
};

// Default and only model
const DEFAULT_MODEL = OPENROUTER_MODELS.LLAMA_3_1_8B;

/**
 * Call OpenRouter API directly (no backend needed - CORS friendly!)
 * @param {string} text - Text to summarize
 * @param {string} model - Model to use
 * @param {string} apiKey - Your OpenRouter API key
 * @param {Object} options - Additional options
 * @returns {Promise<string>} - Generated summary
 */
const callOpenRouterAPI = async (text, model, apiKey, options = {}) => {
  console.log('📤 Calling OpenRouter API:', {
    model,
    textLength: text.length,
    type: options.type
  });

  const systemPrompt = options.type === 'page'
    ? 'You are an expert study assistant. Summarize the following text using  the 80/20 principle: - Extract only the key ideas that give most of the understanding. -Ignore filler, repetition, and minor examples. -Focus on what a student should remember. -Use clear bullet points. -Keep it concise but meaningful. -If the text is unclear or fragmented, still infer the most likely core ideas carefully. Return: 1. 5-8 essential bullet points. 2. 1-2 sentence "core takeaway"'
    : 'You are a helpful assistant that creates comprehensive summaries of document chapters. Provide a detailed summary covering the main themes, key concepts, and important takeaways.';

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin, // Required by OpenRouter
      'X-Title': 'PDF Summarizer', // Optional: Your app name
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `Please summarize the following text:\n\n${text}`
        }
      ],
      max_tokens: options.maxTokens || 500,
      temperature: options.temperature || 0.7,
      top_p: options.topP || 1,
    })
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ OpenRouter API error:', error);
    throw new Error(error.error?.message || `API request failed with status ${response.status}`);
  }

  const result = await response.json();
  console.log('✅ Summary received from OpenRouter');
  
  return result.choices[0]?.message?.content || '';
};

/**
 * Summarize text using OpenRouter API
 * @param {string} text - Text to summarize
 * @param {string} type - 'page' or 'chapter'
 * @param {string} apiKey - Your OpenRouter API key
 * @param {Object} options - Additional options
 * @returns {Promise<string>} - Generated summary
 */
export const summarizeWithOpenRouter = async (text, type = 'page', apiKey, options = {}) => {
  if (!apiKey) {
    throw new Error('OpenRouter API key is required. Get one free at https://openrouter.ai/keys');
  }

  if (!text || text.trim().length === 0) {
    throw new Error('No text provided for summarization');
  }

  try {
    const model = options.model || DEFAULT_MODEL;
    
    // Truncate text if too long (most models have ~4K token context)
    // Approximately 4 characters per token
    const maxInputLength = 12000; // ~3000 tokens (save space for response)
    let inputText = text;
    if (text.length > maxInputLength) {
      console.log(`⚠️ Text too long (${text.length} chars), truncating to ${maxInputLength}`);
      inputText = text.substring(0, maxInputLength) + '\n\n[Text truncated due to length...]';
    }

    const summary = await callOpenRouterAPI(inputText, model, apiKey, {
      type,
      maxTokens: type === 'page' ? 300 : 500,
      ...options
    });

    return summary;
  } catch (error) {
    console.error('OpenRouter API Error:', error);
    throw error;
  }
};

/**
 * Summarize long text by chunking
 * @param {string} text - Long text to summarize
 * @param {string} type - 'page' or 'chapter'
 * @param {string} apiKey - Your OpenRouter API key
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<string>} - Combined summary
 */
export const summarizeLongText = async (text, type, apiKey, onProgress = null) => {
  const chunkSize = 10000; // ~2500 tokens per chunk
  const chunks = [];
  
  // Split text into chunks
  let currentPos = 0;
  while (currentPos < text.length) {
    const chunk = text.substring(currentPos, currentPos + chunkSize);
    chunks.push(chunk);
    currentPos += chunkSize;
  }

  console.log(`📊 Split text into ${chunks.length} chunks for processing`);

  if (chunks.length === 1) {
    // Single chunk, summarize directly
    return await summarizeWithOpenRouter(chunks[0], type, apiKey);
  }

  // Summarize each chunk
  const chunkSummaries = [];
  for (let i = 0; i < chunks.length; i++) {
    try {
      if (onProgress) {
        onProgress(
          Math.round(((i + 1) / chunks.length) * 80), // Reserve 20% for final summary
          `Processing chunk ${i + 1}/${chunks.length}`
        );
      }

      const summary = await summarizeWithOpenRouter(
        chunks[i],
        'page',
        apiKey,
        { maxTokens: 200 }
      );
      chunkSummaries.push(summary);
    } catch (error) {
      console.error(`Error summarizing chunk ${i + 1}:`, error);
      chunkSummaries.push(''); // Add empty summary for failed chunks
    }
  }

  // Combine summaries
  const combinedSummary = chunkSummaries.filter(s => s.length > 0).join('\n\n');

  // If we have multiple chunks, create a final summary of summaries
  if (chunks.length > 1 && combinedSummary.length > 500) {
    try {
      if (onProgress) {
        onProgress(90, 'Generating final summary...');
      }

      const finalSummary = await summarizeWithOpenRouter(
        'Please provide a comprehensive summary of these section summaries:\n\n' + combinedSummary,
        type,
        apiKey,
        { maxTokens: 500 }
      );

      if (onProgress) {
        onProgress(100, 'Complete!');
      }

      return finalSummary;
    } catch (error) {
      console.error('Error creating final summary:', error);
      return combinedSummary;
    }
  }

  return combinedSummary;
};

/**
 * Validate OpenRouter API key
 * @param {string} apiKey - API key to validate
 * @returns {Promise<boolean>} - True if valid
 */
export const validateOpenRouterKey = async (apiKey) => {
  try {
    console.log('🔑 Validating OpenRouter API key...');
    
    // Make a minimal request to test the key
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5
      })
    });

    // If we get 200 or even 400 (bad request but auth worked), key is valid
    // 401 or 403 means invalid key
    if (response.status === 401 || response.status === 403) {
      console.error('❌ API key validation failed: Invalid credentials');
      return false;
    }

    console.log('✅ API key is valid');
    return true;
  } catch (error) {
    console.error('Error validating API key:', error);
    // If we can't validate, assume it might be valid (network issue)
    return true;
  }
};

/**
 * Get available models and their details
 * @param {string} apiKey - API key
 * @returns {Promise<Array>} - List of available models
 */
export const getAvailableModels = async (apiKey) => {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch models');
    }

    const data = await response.json();
    return data.data; // Array of model objects
  } catch (error) {
    console.error('Error fetching models:', error);
    return [];
  }
};

/**
 * Check usage and credits
 * @param {string} apiKey - API key
 * @returns {Promise<Object>} - Usage information
 */
export const checkUsage = async (apiKey) => {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch usage info');
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching usage:', error);
    return null;
  }
};

// Export helper to get API key from environment or localStorage
export const getOpenRouterApiKey = () => {
  // Try environment variable first
  if (import.meta.env.VITE_OPENROUTER_API_KEY) {
    return import.meta.env.VITE_OPENROUTER_API_KEY;
  }
  
  // Try localStorage (for user-provided keys)
  if (typeof window !== 'undefined' && window.localStorage) {
    return localStorage.getItem('openrouter_api_key');
  }
  
  return null;
};

// Helper to save API key to localStorage
export const saveOpenRouterApiKey = (apiKey) => {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem('openrouter_api_key', apiKey);
    return true;
  }
  return false;
};

// Helper to remove API key from localStorage
export const removeOpenRouterApiKey = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem('openrouter_api_key');
    return true;
  }
  return false;
};

// Log configuration on load
console.log('🔧 OpenRouter API initialized with Meta Llama 3 8B (Free)');
