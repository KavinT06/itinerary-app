import { connectToMongoDB } from '../../lib/mongodb';

export async function GET() {
    const checks = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        variables: {
            hasGeminiKey: !!process.env.GEMINI_API_KEY,
            hasMongoDBUri: !!process.env.MONGODB_URI,
        },
    };

    try {
        console.log('🔍 [HEALTH] Running health checks...');

        // Check Gemini API Key
        if (!process.env.GEMINI_API_KEY) {
            checks.gemini = {
                status: 'ERROR',
                message: 'GEMINI_API_KEY environment variable is not set'
            };
            console.error('❌ [HEALTH] GEMINI_API_KEY missing');
        } else {
            checks.gemini = {
                status: 'OK',
                message: 'GEMINI_API_KEY is configured'
            };
            console.log('✅ [HEALTH] GEMINI_API_KEY present');
        }

        // Check MongoDB Connection
        try {
            console.log('🔄 [HEALTH] Testing MongoDB connection...');
            console.log('🔍 [HEALTH] Timeout: 15 seconds');
            
            const mongoTest = await Promise.race([
                connectToMongoDB(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('MongoDB connection timeout')), 15000)
                )
            ]);
            
            const count = await mongoTest.tripPlans.countDocuments();
            checks.mongodb = {
                status: 'OK',
                message: 'MongoDB connected successfully',
                tripCount: count,
                database: 'n_trips',
                collection: 'tripplans'
            };
            console.log('✅ [HEALTH] MongoDB connection successful, found', count, 'trips');
        } catch (mongoError) {
            checks.mongodb = {
                status: 'ERROR',
                message: mongoError.message,
                uri_configured: !!process.env.MONGODB_URI,
                suggestion: !process.env.MONGODB_URI ? 'Set MONGODB_URI environment variable' : 'Check MongoDB connection string and network access'
            };
            console.error('❌ [HEALTH] MongoDB error:', mongoError.message);
        }

        // Check Gemini API
        try {
            console.log('🔄 [HEALTH] Testing Gemini API...');
            const testResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: 'Say hello' }] }],
                    })
                }
            );

            if (testResponse.ok) {
                checks.gemini_api_test = {
                    status: 'OK',
                    message: 'Gemini API is responding'
                };
                console.log('✅ [HEALTH] Gemini API test passed');
            } else {
                const errorData = await testResponse.json().catch(() => ({}));
                checks.gemini_api_test = {
                    status: 'ERROR',
                    message: `Gemini API returned ${testResponse.status}`,
                    details: errorData.error?.message || testResponse.statusText
                };
                console.error('❌ [HEALTH] Gemini API error:', testResponse.status, errorData);
            }
        } catch (geminiError) {
            checks.gemini_api_test = {
                status: 'ERROR',
                message: geminiError.message
            };
            console.error('❌ [HEALTH] Gemini test error:', geminiError.message);
        }

        const hasErrors = Object.values(checks).some(check => 
            check.status === 'ERROR'
        );

        return new Response(JSON.stringify(checks), {
            status: hasErrors ? 503 : 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('❌ [HEALTH] Unexpected error:', error);
        checks.error = error.message;
        return new Response(JSON.stringify(checks), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
