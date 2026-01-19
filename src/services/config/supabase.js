// src/services/config/supabase.js
// ULTRA-FAST SUPABASE CONFIGURATION WITH TIMEOUT FIX

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create optimized Supabase client with fixed timeout handling
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'grova-auth-token',
    flowType: 'pkce'
  },
  global: {
    headers: {
      'x-grova-client': 'web-app'
    },
    // FIXED: Custom fetch with better timeout handling
    fetch: (url, options = {}) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.error('⏱️ Request timeout:', url);
      }, 15000); // 15 second timeout (increased from 10s)

      return fetch(url, {
        ...options,
        signal: controller.signal
      })
        .then(response => {
          clearTimeout(timeoutId);
          return response;
        })
        .catch(error => {
          clearTimeout(timeoutId);
          
          if (error.name === 'AbortError') {
            const errorMsg = new Error('Request timeout. Please check your connection.');
            errorMsg.name = 'TimeoutError';
            errorMsg.originalUrl = url;
            throw errorMsg;
          }
          
          throw error;
        });
    }
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    },
    timeout: 30000 // 30 second timeout for realtime
  }
});

// Retry wrapper for critical operations
export const supabaseWithRetry = async (queryFn, maxRetries = 2, delayMs = 1000) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await queryFn();
      return result;
    } catch (error) {
      lastError = error;
      
      // Don't retry on auth errors, validation errors, or not found
      if (
        error.code === 'PGRST301' || // not found
        error.code === '23505' ||     // unique violation
        error.code === '42501' ||     // insufficient privilege
        error.message?.includes('JWT') ||
        error.message?.includes('not authenticated')
      ) {
        throw error;
      }
      
      // Don't retry timeout errors on last attempt
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      const delay = delayMs * Math.pow(2, attempt);
      console.log(`🔄 Retrying in ${delay}ms... (Attempt ${attempt + 2}/${maxRetries + 1})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

// Helper to check if error is timeout
export const isTimeoutError = (error) => {
  return error?.name === 'TimeoutError' || 
         error?.name === 'AbortError' ||
         error?.message?.includes('timeout');
};

// Helper to execute with timeout
export const withTimeout = (promise, timeoutMs = 15000, errorMessage = 'Operation timed out') => {
  let timeoutId;
  
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(errorMessage);
      error.name = 'TimeoutError';
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([
    promise.finally(() => clearTimeout(timeoutId)),
    timeoutPromise
  ]);
};

// Batch requests helper to avoid rate limiting
export const batchRequests = async (requests, batchSize = 3, delayMs = 100) => {
  const results = [];
  
  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(req => req()));
    results.push(...batchResults);
    
    // Delay between batches to avoid rate limiting
    if (i + batchSize < requests.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
};

export default supabase;