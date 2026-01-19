// ============================================================================
// supabase/functions/generate-media-url/index.ts
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// CORS headers for ALL responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME')!;
const CLOUDINARY_API_KEY = Deno.env.get('CLOUDINARY_API_KEY')!;
const CLOUDINARY_API_SECRET = Deno.env.get('CLOUDINARY_API_SECRET')!;

// Generate Cloudinary signature
function generateSignature(params: Record<string, any>): string {
  const crypto = globalThis.crypto.subtle;
  
  // Sort parameters
  const sortedParams = Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== null)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  const stringToSign = `${sortedParams}${CLOUDINARY_API_SECRET}`;
  
  // Create SHA-256 hash
  const encoder = new TextEncoder();
  const data = encoder.encode(stringToSign);
  
  return crypto.digest('SHA-256', data)
    .then((hashBuffer: ArrayBuffer) => {
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    });
}

// Generate signed Cloudinary URL
async function generateCloudinaryUrl(
  publicId: string,
  resourceType: 'image' | 'video' = 'image',
  transformations: Record<string, any> = {}
): Promise<{ url: string; expiresAt: number }> {
  
  const timestamp = Math.floor(Date.now() / 1000);
  const expiresAt = timestamp + 3600; // 1 hour expiry
  
  // Build transformation string
  const transforms: string[] = [];
  
  if (resourceType === 'image') {
    transforms.push('f_auto', 'q_auto:best', 'dpr_auto');
  } else {
    transforms.push('q_auto');
  }
  
  if (transformations.width) transforms.push(`w_${transformations.width}`);
  if (transformations.height) transforms.push(`h_${transformations.height}`);
  if (transformations.crop) transforms.push(`c_${transformations.crop}`);
  if (transformations.gravity) transforms.push(`g_${transformations.gravity}`);
  if (transformations.quality) transforms.push(`q_${transformations.quality}`);
  if (transformations.format) transforms.push(`f_${transformations.format}`);
  
  const transformString = transforms.join(',');
  
  // Generate signature parameters
  const signatureParams = {
    timestamp: timestamp.toString(),
    public_id: publicId,
    type: 'authenticated',
  };
  
  const signature = await generateSignature(signatureParams);
  
  // Build authenticated URL
  const baseUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}`;
  const mediaType = resourceType === 'video' ? 'video' : 'image';
  
  const url = `${baseUrl}/${mediaType}/authenticated/s--${signature}--/${transformString}/${publicId}`;
  
  return { url, expiresAt };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: corsHeaders,
      status: 200 
    });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Parse request body
    const { publicId, resourceType = 'image', transformations = {} } = await req.json();

    if (!publicId) {
      return new Response(
        JSON.stringify({ error: 'publicId is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Generate signed URL
    const { url, expiresAt } = await generateCloudinaryUrl(
      publicId,
      resourceType,
      transformations
    );

    return new Response(
      JSON.stringify({ url, expiresAt }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error generating media URL:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});