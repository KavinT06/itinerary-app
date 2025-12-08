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
        const { destination, startDate, endDate, createdBy } = await request.json();
        
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

        console.log('🔄 [API] Connecting to MongoDB...');
        const { tripPlans } = await connectToMongoDB();
        console.log('✅ [API] MongoDB connected');
        
        console.log('🔄 [API] Requesting AI response from Gemini...');
        const AiPlan = await requestAIResponse(prompt);
        console.log('✅ [API] AI response received');
        console.log('🔄 [API] Saving trip to database...');
        
        const savedTrip = await tripPlans.insertOne(AiPlan);
        console.log('✅ [API] Trip saved successfully');
        console.log('🔍 [API] Saved trip ID:', savedTrip.insertedId);
        
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
        console.error('   Stack:', error.stack);
        console.error('   Type:', error.constructor.name);
        
        return new Response(JSON.stringify({ 
            error: 'Failed to generate trip',
            details: error.message,
            type: error.constructor.name
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}