import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request) {
    try {
        const payload = await request.json();
        const { destination, startDate, endDate, createdBy } = payload;

        // Validate required fields
        if (!destination || !startDate || !endDate || !createdBy) {
            return new Response(JSON.stringify({ 
                error: 'Missing required fields'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Validate API key
        const apiKey = process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
            return new Response(JSON.stringify({
                error: 'AI service not properly configured'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Initialize Gemini
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

        if (!result || !result.response) {
            throw new Error('Invalid response from AI service');
        }

        const response = result.response;
        let textResponse = response.text();

        if (!textResponse || textResponse.length === 0) {
            throw new Error('AI service returned empty response');
        }

        // Clean up response (remove markdown code blocks)
        textResponse = textResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Parse JSON
        let tripPlan;
        try {
            tripPlan = JSON.parse(textResponse);
        } catch (parseError) {
            throw new Error('Failed to parse AI response as JSON');
        }

        // Add metadata
        tripPlan.id = Date.now().toString();
        tripPlan.generatedAt = new Date().toISOString();

        return new Response(JSON.stringify({
            success: true,
            trip: tripPlan
        }), {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store'
            },
        });

    } catch (error) {
        let statusCode = 500;
        let errorMessage = 'Failed to generate trip';
        let userFriendlyDetails = error.message;

        if (error.message.includes('API key') || error.message.includes('401') || error.message.includes('403')) {
            statusCode = 401;
            errorMessage = 'AI service authentication failed';
            userFriendlyDetails = 'Invalid or missing API key';
        } else if (error.message.includes('quota') || error.message.includes('rate limit') || error.message.includes('429')) {
            statusCode = 429;
            errorMessage = 'AI service rate limit exceeded';
            userFriendlyDetails = 'Too many requests. Please try again later';
        } else if (error.message.includes('timeout') || error.name === 'AbortError') {
            statusCode = 504;
            errorMessage = 'Request timed out';
            userFriendlyDetails = 'Request took too long. Please try again';
        } else if (error.message.includes('JSON')) {
            statusCode = 500;
            errorMessage = 'Invalid AI response format';
            userFriendlyDetails = 'AI returned invalid response. Please try again';
        }

        return new Response(JSON.stringify({
            error: errorMessage,
            details: userFriendlyDetails
        }), {
            status: statusCode,
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store'
            },
        });
    }
}

// Add OPTIONS handler for CORS
export async function OPTIONS(request) {
    return new Response(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}