import { GoogleGenerativeAI } from '@google/generative-ai';

// Simple in-memory rate limiting
const requestCache = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 10; // Max requests per minute per IP

function checkRateLimit(identifier) {
    const now = Date.now();
    const userRequests = requestCache.get(identifier) || [];
    
    // Filter out old requests outside the window
    const recentRequests = userRequests.filter(time => now - time < RATE_LIMIT_WINDOW);
    
    if (recentRequests.length >= MAX_REQUESTS_PER_MINUTE) {
        return { allowed: false, remaining: 0, resetIn: Math.ceil((recentRequests[0] + RATE_LIMIT_WINDOW - now) / 1000) };
    }
    
    recentRequests.push(now);
    requestCache.set(identifier, recentRequests);
    
    // Clean up old entries periodically
    if (requestCache.size > 1000) {
        const cutoff = now - RATE_LIMIT_WINDOW;
        for (const [key, times] of requestCache.entries()) {
            const validTimes = times.filter(t => t > cutoff);
            if (validTimes.length === 0) {
                requestCache.delete(key);
            } else {
                requestCache.set(key, validTimes);
            }
        }
    }
    
    return { allowed: true, remaining: MAX_REQUESTS_PER_MINUTE - recentRequests.length };
}

export async function POST(request) {
    try {
        // Get client identifier for rate limiting
        const forwardedFor = request.headers.get('x-forwarded-for');
        const realIp = request.headers.get('x-real-ip');
        const clientId = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';
        
        // Check rate limit
        const rateLimitResult = checkRateLimit(clientId);
        if (!rateLimitResult.allowed) {
            console.log(`Rate limit exceeded for client: ${clientId}`);
            return new Response(JSON.stringify({
                error: 'Too many requests',
                details: `Please wait ${rateLimitResult.resetIn} seconds before trying again`,
                retryAfter: rateLimitResult.resetIn
            }), {
                status: 429,
                headers: { 
                    'Content-Type': 'application/json',
                    'Retry-After': String(rateLimitResult.resetIn)
                },
            });
        }

        const payload = await request.json();
        const { destination, startDate, endDate, createdBy } = payload;

        // Validate required fields
        if (!destination || !startDate || !endDate || !createdBy) {
            return new Response(JSON.stringify({ 
                error: 'Missing required fields'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Validate API key
        const apiKey = process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
            console.error('GEMINI_API_KEY environment variable is not set');
            return new Response(JSON.stringify({
                error: 'AI service not properly configured',
                details: 'Server configuration error. Please contact support.',
                debug: process.env.NODE_ENV === 'development' ? 'GEMINI_API_KEY is missing' : undefined
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Log API key status (first 4 chars only for security)
        console.log(`API Key configured: ${apiKey.substring(0, 4)}...`);

        // Initialize Gemini with configuration
        const genAI = new GoogleGenerativeAI(apiKey);
        
        // Use gemini-1.5-flash-8b - best free tier model with higher rate limits
        // Free tier: 15 RPM, 1 million TPM, 1,500 RPD
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-1.5-flash-8b',
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 4096,
            }
        });

        // Calculate duration
        const start = new Date(startDate);
        const end = new Date(endDate);
        const durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

        // Create detailed prompt
        const prompt = `Create a detailed ${durationDays}-day travel itinerary for ${destination} from ${startDate} to ${endDate}.

Traveler: ${createdBy}

Please provide a comprehensive trip plan in JSON format with this EXACT structure:
{
  "title": "Trip to [destination]",
  "destination": "${destination}",
  "startDate": "${startDate}",
  "endDate": "${endDate}",
  "createdBy": "${createdBy}",
  "participants": [{"name": "${createdBy}", "email": "traveler@example.com"}],
  "days": [
    {
      "day": 1,
      "date": "${startDate}",
      "location": "[main location for day]",
      "activities": [
        {
          "time": "09:00 AM",
          "title": "[Activity name]",
          "description": "[Detailed description]",
          "location": "[Specific location]",
          "notes": "[Helpful tips]"
        }
      ]
    }
  ],
  "notes": "General travel tips and recommendations for ${destination}",
  "budget": {
    "currency": "USD",
    "estimated": [reasonable estimate for ${durationDays} days],
    "spent": 0
  }
}

Create ${durationDays} days with 4-6 activities per day. Include morning, afternoon, and evening activities. Make it realistic and engaging.

IMPORTANT: Return ONLY valid JSON. No markdown, no code blocks, no explanatory text before or after.`;

        // Generate content with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        let result;
        try {
            result = await model.generateContent(prompt);
            clearTimeout(timeoutId);
        } catch (genError) {
            clearTimeout(timeoutId);
            throw genError;
        }

        if (!result || !result.response) {
            throw new Error('Invalid response from AI service');
        }

        const response = result.response;
        let textResponse = response.text();

        if (!textResponse || textResponse.length === 0) {
            throw new Error('AI service returned empty response');
        }

        // Clean up response (remove markdown code blocks)
        textResponse = textResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Parse JSON
        let tripPlan;
        try {
            tripPlan = JSON.parse(textResponse);
        } catch (parseError) {
            throw new Error('Failed to parse AI response as JSON');
        }

        // Add metadata
        tripPlan.id = Date.now().toString();
        tripPlan.generatedAt = new Date().toISOString();

        return new Response(JSON.stringify({
            success: true,
            trip: tripPlan
        }), {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store'
            },
        });

    } catch (error) {
        console.error('Error generating trip:', error.message, error.stack);
        
        let statusCode = 500;
        let errorMessage = 'Failed to generate trip';
        let userFriendlyDetails = error.message;

        // Check for various error types
        const errorStr = error.message?.toLowerCase() || '';
        const errorName = error.name?.toLowerCase() || '';
        
        if (errorStr.includes('api key') || errorStr.includes('api_key') || 
            errorStr.includes('401') || errorStr.includes('403') || 
            errorStr.includes('invalid') && errorStr.includes('key')) {
            statusCode = 401;
            errorMessage = 'AI service authentication failed';
            userFriendlyDetails = 'Invalid or missing API key. Please check server configuration.';
        } else if (errorStr.includes('quota') || errorStr.includes('rate') || 
                   errorStr.includes('429') || errorStr.includes('resource') && errorStr.includes('exhausted') ||
                   errorStr.includes('too many')) {
            statusCode = 429;
            errorMessage = 'AI service rate limit exceeded';
            userFriendlyDetails = 'The AI service is temporarily unavailable due to high demand. Please wait 1-2 minutes and try again.';
        } else if (errorStr.includes('timeout') || errorName === 'aborterror' || errorStr.includes('aborted')) {
            statusCode = 504;
            errorMessage = 'Request timed out';
            userFriendlyDetails = 'Request took too long. Please try again';
        } else if (errorStr.includes('json') || errorStr.includes('parse')) {
            statusCode = 500;
            errorMessage = 'Invalid AI response format';
            userFriendlyDetails = 'AI returned invalid response. Please try again';
        } else if (errorStr.includes('network') || errorStr.includes('fetch') || errorStr.includes('econnrefused')) {
            statusCode = 503;
            errorMessage = 'Network error';
            userFriendlyDetails = 'Could not connect to AI service. Please try again.';
        }

        return new Response(JSON.stringify({
            error: errorMessage,
            details: userFriendlyDetails,
            // Include debug info only in development
            ...(process.env.NODE_ENV === 'development' && { debugError: error.message })
        }), {
            status: statusCode,
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store'
            },
        });
    }
}

// Add OPTIONS handler for CORS
export async function OPTIONS(request) {
    return new Response(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}