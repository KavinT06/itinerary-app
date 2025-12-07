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
        
        if (!destination || !startDate || !endDate || !createdBy) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        const prompt = `Give me a trip plan for ${destination} from ${startDate} to ${endDate} created by ${createdBy} in JSON format.`;

        const { tripPlans } = await connectToMongoDB();
        const AiPlan = await requestAIResponse(prompt);
        const savedTrip = await tripPlans.insertOne(AiPlan);
        
        return new Response(JSON.stringify(savedTrip), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error generating trip:', error.message);
        console.error('Stack:', error.stack);
        return new Response(JSON.stringify({ 
            error: 'Failed to generate trip',
            details: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}