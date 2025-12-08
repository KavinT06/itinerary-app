export async function GET() {
    const result = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        checks: {
            mongodb_uri_set: !!process.env.MONGODB_URI,
            mongodb_uri_sample: process.env.MONGODB_URI ? 
                process.env.MONGODB_URI.substring(0, 50) + '...' : 'NOT_SET',
            gemini_key_set: !!process.env.GEMINI_API_KEY,
        }
    };

    // If URI not set, return early
    if (!process.env.MONGODB_URI) {
        result.error = 'MONGODB_URI not configured';
        result.guidance = {
            local: 'Create .env.local with: MONGODB_URI=mongodb://localhost:27017/n_trips',
            production: 'Add MONGODB_URI to Vercel Environment Variables (mongodb+srv://...)',
            help: 'See .env.local.example for template'
        };
        return new Response(JSON.stringify(result, null, 2), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Try to connect
    try {
        console.log('🔄 [TEST] Importing MongoDB module...');
        const { connectToMongoDB } = await import('../../lib/mongodb.js');
        
        console.log('🔄 [TEST] Calling connectToMongoDB()...');
        const connection = await connectToMongoDB();
        
        console.log('✅ [TEST] Connection successful');
        result.checks.mongodb_connection = 'SUCCESS';
        
        if (connection.tripPlans) {
            console.log('🔄 [TEST] Counting documents...');
            const count = await connection.tripPlans.countDocuments();
            result.checks.document_count = count;
            result.checks.database = 'n_trips';
            result.checks.collection = 'tripplans';
            console.log('✅ [TEST] Found', count, 'documents');
        }
        
        result.status = 'OK - Ready to use!';
        
    } catch (error) {
        console.error('❌ [TEST] Error:', error.message);
        result.checks.mongodb_connection = 'FAILED';
        result.error = error.message;
        result.error_type = error.name;
        result.error_code = error.code;
        
        // Provide solutions
        if (error.message.includes('ECONNREFUSED')) {
            result.solution = 'MongoDB is not running. Start MongoDB: mongod';
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
            result.solution = 'Cannot reach MongoDB. Check hostname in connection string';
        } else if (error.message.includes('authentication')) {
            result.solution = 'Authentication failed. Check username/password';
        } else if (error.message.includes('timeout')) {
            result.solution = 'Connection timeout. Check MongoDB is running and accessible';
        }
    }

    return new Response(JSON.stringify(result, null, 2), {
        status: result.checks.mongodb_connection === 'SUCCESS' ? 200 : 500,
        headers: { 'Content-Type': 'application/json' },
    });
}
