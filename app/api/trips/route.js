import { connectToMongoDB } from '../../lib/mongodb';
import { requestAIResponse, saveTrip } from './utils';

export async function GET() {
    try {
        const { tripPlans } = await connectToMongoDB();
        const savedTrip = await tripPlans.find({}).toArray();
        return new Response(JSON.stringify(savedTrip), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Fetch error:', error);
        return new Response(JSON.stringify({ error: 'Something went wrong' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

export async function POST(request) {
    try {
        const payload = await request.json();
        const { destination, startDate, endDate, createdBy } = payload;
        
        console.log('📨 [API] POST request received');
        console.log('📨 [API] Payload:', { destination, startDate, endDate, createdBy });
        
        if (!destination || !startDate || !endDate || !createdBy) {
            console.error('❌ [API] Missing required fields');
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        const prompt = `Give me a trip plan for ${destination} from ${startDate} to ${endDate} created by ${createdBy} in JSON format.`;

        console.log('🔄 [API] Step 1: Connecting to MongoDB...');
        let mongoConnection;
        try {
            mongoConnection = await connectToMongoDB();
            console.log('✅ [API] Step 1: MongoDB connected');
        } catch (mongoError) {
            console.error('❌ [API] Step 1 failed: MongoDB connection error');
            console.error('   ', mongoError.message);
            throw mongoError;
        }
        
        const { tripPlans } = mongoConnection;
        
        console.log('🔄 [API] Step 2: Requesting AI response from Gemini...');
        let AiPlan;
        try {
            AiPlan = await requestAIResponse(prompt);
            console.log('✅ [API] Step 2: AI response received');
            console.log('🔍 [API] Response has', Object.keys(AiPlan).length, 'properties');
        } catch (aiError) {
            console.error('❌ [API] Step 2 failed: Gemini API error');
            console.error('   ', aiError.message);
            throw aiError;
        }
        
        console.log('🔄 [API] Step 3: Saving trip to database...');
        let savedTrip;
        try {
            savedTrip = await tripPlans.insertOne(AiPlan);
            console.log('✅ [API] Step 3: Trip saved successfully');
            console.log('🔍 [API] Saved trip ID:', savedTrip.insertedId);
        } catch (saveError) {
            console.error('❌ [API] Step 3 failed: Database save error');
            console.error('   ', saveError.message);
            throw saveError;
        }
        
        return new Response(JSON.stringify({
            acknowledged: true,
            insertedId: savedTrip.insertedId.toString(),
            success: true,
            tripId: savedTrip.insertedId.toString(),
            trip: AiPlan
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('❌ [API] Error generating trip');
        console.error('   Message:', error.message);
        console.error('   Name:', error.name);
        console.error('   Code:', error.code);
        
        // Determine appropriate status code and user-friendly message
        let statusCode = 500;
        let errorMessage = 'Failed to generate trip';
        let userFriendlyDetails = error.message;
        
        if (error.message.includes('MongoDB') || error.message.includes('connection')) {
            statusCode = 503;
            errorMessage = 'Database service unavailable';
            userFriendlyDetails = 'Unable to connect to database. Please try again later.';
        } else if (error.message.includes('leaked')) {
            statusCode = 401;
            errorMessage = 'AI service authentication failed';
            userFriendlyDetails = 'Your API key was compromised. A new key is required. Contact support.';
        } else if (error.message.includes('authentication failed') || error.message.includes('401') || error.message.includes('403')) {
            statusCode = 401;
            errorMessage = 'AI service not properly configured';
            userFriendlyDetails = error.message;
        } else if (error.message.includes('quota') || error.message.includes('rate limit') || error.message.includes('429')) {
            statusCode = 429;
            errorMessage = 'AI service limit reached';
            userFriendlyDetails = 'Too many requests. Please try again in a few moments.';
        } else if (error.message.includes('timeout') || error.message.includes('504')) {
            statusCode = 504;
            errorMessage = 'Request timed out';
            userFriendlyDetails = 'The request took too long. Please try again.';
        }
        
        console.error('   Final status:', statusCode);
        console.error('   Final message:', errorMessage);
        
        return new Response(JSON.stringify({ 
            error: errorMessage,
            details: userFriendlyDetails,
            type: error.constructor.name
        }), {
            status: statusCode,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}