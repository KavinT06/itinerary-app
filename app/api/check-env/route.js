export async function GET() {
    const apiKey = process.env.GEMINI_API_KEY;
    const nodeEnv = process.env.NODE_ENV;
    const vercelEnv = process.env.VERCEL_ENV;
    
    return Response.json({
        status: apiKey ? 'configured' : 'missing',
        hasGeminiKey: !!apiKey,
        keyLength: apiKey?.length || 0,
        keyPrefix: apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : 'MISSING',
        environment: {
            nodeEnv: nodeEnv || 'not set',
            vercelEnv: vercelEnv || 'not set (local)',
            isProduction: nodeEnv === 'production'
        },
        message: apiKey 
            ? `API key is configured (${apiKey.length} characters)` 
            : 'ERROR: GEMINI_API_KEY is NOT configured. Add it to Vercel Environment Variables.',
        timestamp: new Date().toISOString()
    });
}
