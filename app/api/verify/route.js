/**
 * Simple verification endpoint to check all configurations
 */
export async function GET() {
    const checks = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
    };

    // Check 1: MongoDB
    console.log('🔍 [VERIFY] Checking MongoDB URI...');
    if (!process.env.MONGODB_URI) {
        checks.mongodb = { status: 'ERROR', message: 'MONGODB_URI not set' };
    } else {
        checks.mongodb = { 
            status: 'CONFIGURED',
            uri_sample: process.env.MONGODB_URI.substring(0, 40) + '...'
        };
    }

    // Check 2: Gemini API Key
    console.log('🔍 [VERIFY] Checking Gemini API Key...');
    if (!process.env.GEMINI_API_KEY) {
        checks.gemini = { status: 'ERROR', message: 'GEMINI_API_KEY not set' };
    } else {
        checks.gemini = { 
            status: 'CONFIGURED',
            key_length: process.env.GEMINI_API_KEY.length,
            key_sample: process.env.GEMINI_API_KEY.substring(0, 10) + '...' + process.env.GEMINI_API_KEY.substring(process.env.GEMINI_API_KEY.length - 5)
        };
    }

    // Check 3: Test Gemini API Key Validity
    console.log('🔍 [VERIFY] Testing Gemini API Key validity...');
    try {
        const testResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: 'Say "OK"' }] }],
                    generationConfig: { maxOutputTokens: 10 }
                })
            }
        );

        console.log('📥 [VERIFY] Gemini test response status:', testResponse.status);

        if (testResponse.status === 200) {
            const testData = await testResponse.json();
            checks.gemini_test = { 
                status: 'OK', 
                message: 'API key is valid and working',
                response_has_candidates: !!testData.candidates
            };
            console.log('✅ [VERIFY] Gemini API key is valid');
        } else if (testResponse.status === 401 || testResponse.status === 403) {
            const errorData = await testResponse.json().catch(() => ({}));
            const errorMsg = errorData.error?.message || 'Authentication failed';
            checks.gemini_test = { 
                status: 'ERROR', 
                message: errorMsg,
                code: testResponse.status
            };
            console.error('❌ [VERIFY] Authentication error:', errorMsg);
        } else if (testResponse.status === 429) {
            checks.gemini_test = { 
                status: 'ERROR', 
                message: 'Rate limit exceeded',
                code: 429
            };
            console.error('❌ [VERIFY] Rate limit');
        } else {
            const errorData = await testResponse.json().catch(() => ({}));
            checks.gemini_test = { 
                status: 'ERROR', 
                message: errorData.error?.message || testResponse.statusText,
                code: testResponse.status
            };
            console.error('❌ [VERIFY] Unexpected error:', testResponse.status);
        }
    } catch (error) {
        checks.gemini_test = { 
            status: 'ERROR', 
            message: error.message,
            name: error.name
        };
        console.error('❌ [VERIFY] Error testing Gemini:', error.message);
    }

    // Check 4: Test MongoDB Connection
    console.log('🔍 [VERIFY] Testing MongoDB connection...');
    try {
        const { connectToMongoDB } = await import('../../lib/mongodb.js');
        const connection = await connectToMongoDB();
        const count = await connection.tripPlans.countDocuments();
        
        checks.mongodb_test = { 
            status: 'OK', 
            message: 'Successfully connected and queried',
            document_count: count
        };
        console.log('✅ [VERIFY] MongoDB connection successful');
    } catch (error) {
        checks.mongodb_test = { 
            status: 'ERROR', 
            message: error.message,
            name: error.name
        };
        console.error('❌ [VERIFY] MongoDB connection failed:', error.message);
    }

    const hasErrors = Object.values(checks).some(check => 
        check.status === 'ERROR'
    );

    return new Response(JSON.stringify(checks, null, 2), {
        status: hasErrors ? 503 : 200,
        headers: { 'Content-Type': 'application/json' },
    });
}
