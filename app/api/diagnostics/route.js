import { connectToMongoDB } from '../../lib/mongodb';

export async function GET() {
    const diagnostics = {
        timestamp: new Date().toISOString(),
        environment: {
            nodeEnv: process.env.NODE_ENV,
            hasMongodbUri: !!process.env.MONGODB_URI,
            mongodbUriStart: process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 30) + '...' : 'NOT SET',
            hasGeminiKey: !!process.env.GEMINI_API_KEY,
        },
        tests: {}
    };

    // Test 1: Check environment variables
    console.log('🔍 [DIAG] Starting diagnostics...');
    
    if (!process.env.MONGODB_URI) {
        diagnostics.tests.env = {
            status: 'CRITICAL',
            message: 'MONGODB_URI is not set',
            solution: 'Add MONGODB_URI to your .env.local (local) or Vercel Environment Variables (production)',
            example: 'mongodb+srv://username:password@cluster.mongodb.net/n_trips?retryWrites=true&w=majority'
        };
        console.error('❌ [DIAG] MONGODB_URI not set');
        return new Response(JSON.stringify(diagnostics), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    diagnostics.tests.env = {
        status: 'OK',
        message: 'MONGODB_URI is configured'
    };

    // Test 2: Parse MongoDB URI
    try {
        const url = new URL(process.env.MONGODB_URI);
        diagnostics.tests.uriParsing = {
            status: 'OK',
            protocol: url.protocol,
            hostname: url.hostname,
            database: url.pathname,
            hasPassword: !!url.password
        };
        console.log('✅ [DIAG] URI parsed successfully');
    } catch (error) {
        diagnostics.tests.uriParsing = {
            status: 'ERROR',
            message: error.message,
            solution: 'Check your MONGODB_URI format'
        };
        console.error('❌ [DIAG] URI parsing failed:', error.message);
    }

    // Test 3: MongoDB Connection
    try {
        console.log('🔄 [DIAG] Testing MongoDB connection...');
        const startTime = Date.now();
        
        const { tripPlans } = await connectToMongoDB();
        const connectionTime = Date.now() - startTime;

        // Try to count documents
        const count = await tripPlans.countDocuments();
        
        diagnostics.tests.mongoConnection = {
            status: 'OK',
            message: 'Successfully connected to MongoDB',
            connectionTime: `${connectionTime}ms`,
            tripCount: count,
            database: 'n_trips',
            collection: 'tripplans'
        };
        
        console.log('✅ [DIAG] MongoDB connection successful in', connectionTime, 'ms');

    } catch (mongoError) {
        diagnostics.tests.mongoConnection = {
            status: 'ERROR',
            message: mongoError.message,
            errorName: mongoError.name,
            errorCode: mongoError.code,
            solutions: getSolutions(mongoError)
        };
        
        console.error('❌ [DIAG] MongoDB connection failed:', mongoError.message);
    }

    // Test 4: Gemini API
    if (!process.env.GEMINI_API_KEY) {
        diagnostics.tests.geminiKey = {
            status: 'WARNING',
            message: 'GEMINI_API_KEY is not set',
            solution: 'Add GEMINI_API_KEY to environment variables'
        };
    } else {
        diagnostics.tests.geminiKey = {
            status: 'OK',
            message: 'GEMINI_API_KEY is configured'
        };
    }

    const hasErrors = Object.values(diagnostics.tests).some(test => 
        test.status === 'ERROR' || test.status === 'CRITICAL'
    );

    return new Response(JSON.stringify(diagnostics, null, 2), {
        status: hasErrors ? 503 : 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

function getSolutions(error) {
    const message = error.message || '';
    const code = error.code || '';

    const solutions = [];

    if (message.includes('ENOTFOUND') || message.includes('getaddrinfo')) {
        solutions.push('DNS resolution failed - MongoDB hostname not found');
        solutions.push('Solution 1: Verify the MongoDB hostname in your connection string');
        solutions.push('Solution 2: Check if your network allows DNS resolution');
        solutions.push('Solution 3: For Vercel: Check if MongoDB Atlas IP whitelist includes Vercel IPs (add 0.0.0.0/0 for serverless)');
    }

    if (message.includes('authentication failed') || code === 'EAUTH') {
        solutions.push('Authentication failed - username/password incorrect');
        solutions.push('Solution: Check MongoDB username and password in your connection string');
    }

    if (message.includes('ETIMEDOUT') || message.includes('timeout')) {
        solutions.push('Connection timeout - can\'t reach MongoDB server');
        solutions.push('Solution 1: Check if MongoDB server is running');
        solutions.push('Solution 2: Check firewall rules and IP whitelist');
        solutions.push('Solution 3: For Vercel: Add 0.0.0.0/0 to MongoDB Atlas Network Access');
    }

    if (message.includes('ECONNREFUSED')) {
        solutions.push('Connection refused - MongoDB not running or wrong port');
        solutions.push('Solution 1: Ensure MongoDB is running');
        solutions.push('Solution 2: Check if you\'re using correct connection string');
    }

    if (solutions.length === 0) {
        solutions.push('See error message for details');
        solutions.push('Check MongoDB Atlas status: https://status.mongodb.com/');
    }

    return solutions;
}
