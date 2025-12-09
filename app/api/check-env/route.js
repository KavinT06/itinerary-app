export async function GET() {
    const apiKey = process.env.GEMINI_API_KEY;
    
    return Response.json({
        hasGeminiKey: !!apiKey,
        keyLength: apiKey?.length || 0,
        keyPrefix: apiKey?.substring(0, 8) + '...' || 'MISSING',
        message: apiKey ? 'API key is loaded' : 'API key is NOT loaded'
    });
}
