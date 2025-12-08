import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request) {
    console.log('🔍 [API] POST /api/trips - Request received');
    
    try {
        const payload = await request.json();
        const { destination, startDate, endDate, createdBy } = payload;
        
        console.log('📝 [API] Request payload:', {
            destination,
            startDate,
            endDate,
            createdBy,
            timestamp: new Date().toISOString()
        });

        // Validate required fields
        if (!destination || !startDate || !endDate || !createdBy) {
            console.error('❌ [API] Missing required fields');
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Validate API key
        const apiKey = process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
            console.error('❌ [GEMINI] API Key is missing!');
            console.error('   Environment variables available:', Object.keys(process.env).filter(k => k.includes('GEMINI')));
            return new Response(JSON.stringify({
                error: 'AI service not properly configured - API key missing'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        console.log('✅ [GEMINI] API Key found');

        // Initialize Gemini
        console.log('🤖 [GEMINI] Initializing AI...');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

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

        console.log('📤 [GEMINI] Sending request to Gemini API...');
        console.log('   Prompt length:', prompt.length);
        console.log('   Duration:', durationDays, 'days');

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

        console.log('📥 [GEMINI] Response received');

        if (!result || !result.response) {
            console.error('❌ [GEMINI] Invalid response structure:', result);
            throw new Error('Invalid response from AI service');
        }

        const response = result.response;
        let textResponse = response.text();

        console.log('✅ [GEMINI] Text extracted');
        console.log('   Response length:', textResponse?.length || 0);

        if (!textResponse || textResponse.length === 0) {
            console.error('❌ [GEMINI] Empty response received');
            throw new Error('AI service returned empty response');
        }

        // Clean up response (remove markdown code blocks if present)
        textResponse = textResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Parse JSON
        let tripPlan;
        try {
            tripPlan = JSON.parse(textResponse);
            console.log('✅ [API] JSON parsed successfully');
            console.log('   Trip has', tripPlan.days?.length || 0, 'days');
        } catch (parseError) {
            console.error('❌ [API] JSON parsing failed:', parseError.message);
            console.error('   Response preview:', textResponse.substring(0, 200));
            throw new Error('Failed to parse AI response as JSON');
        }

        // Add generated ID and timestamp
        tripPlan.id = Date.now().toString();
        tripPlan.generatedAt = new Date().toISOString();

        console.log('✅ [API] Sending response to client');
        console.log('   Trip ID:', tripPlan.id);

        return new Response(JSON.stringify({
            success: true,
            trip: tripPlan
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('❌ [ERROR] Detailed error information:');
        console.error('   Message:', error.message);
        console.error('   Name:', error.name);
        console.error('   Stack:', error.stack);
        
        // Determine appropriate error response
        let statusCode = 500;
        let errorMessage = 'Failed to generate trip';
        let userFriendlyDetails = error.message;

        if (error.message.includes('API key') || error.message.includes('401') || error.message.includes('403')) {
            statusCode = 401;
            errorMessage = 'AI service authentication failed';
            userFriendlyDetails = 'Invalid or missing API key. Please check configuration.';
        } else if (error.message.includes('quota') || error.message.includes('rate limit') || error.message.includes('429')) {
            statusCode = 429;
            errorMessage = 'AI service limit reached';
            userFriendlyDetails = 'Too many requests. Please try again in a few moments.';
        } else if (error.message.includes('timeout') || error.name === 'AbortError') {
            statusCode = 504;
            errorMessage = 'Request timed out';
            userFriendlyDetails = 'The request took too long. Please try again.';
        }

        console.error('   Final status:', statusCode);
        console.error('   Final message:', errorMessage);

        return new Response(JSON.stringify({
            error: errorMessage,
            details: userFriendlyDetails,
            timestamp: new Date().toISOString()
        }), {
            status: statusCode,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}