/**
 * Debug endpoint - Tests the actual Gemini API call
 */
export async function POST(request) {
    try {
        const { destination, startDate, endDate, createdBy } = await request.json();

        console.log('🔍 [DEBUG] Starting Gemini test');
        console.log('🔍 [DEBUG] Payload:', { destination, startDate, endDate, createdBy });

        const prompt = `Give me a trip plan for ${destination} from ${startDate} to ${endDate} created by ${createdBy} in JSON format.`;

        const apiKey = process.env.GEMINI_API_KEY;
        console.log('🔍 [DEBUG] API Key present:', !!apiKey);
        console.log('🔍 [DEBUG] API Key length:', apiKey?.length || 0);
        console.log('🔍 [DEBUG] API Key preview:', apiKey ? apiKey.substring(0, 20) + '...' : 'MISSING');

        if (!apiKey) {
            return new Response(JSON.stringify({
                success: false,
                error: 'GEMINI_API_KEY is not set',
                environment: process.env.NODE_ENV
            }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const enhancedPrompt = `${prompt}\n\nRespond with ONLY valid JSON. No markdown, no code blocks, no explanatory text.\n\nRequired structure:\n{\n  "title": "string",\n  "destination": "string",\n  "startDate": "string (YYYY-MM-DD)",\n  "endDate": "string (YYYY-MM-DD)",\n  "createdBy": "string",\n  "participants": [{"name": "string", "email": "string"}],\n  "days": [{\n    "day": number,\n    "date": "string (YYYY-MM-DD)",\n    "location": "string",\n    "activities": [{\n      "time": "string",\n      "title": "string",\n      "description": "string",\n      "location": "string",\n      "notes": "string"\n    }]\n  }],\n  "notes": "string",\n  "budget": {"currency": "string", "estimated": number, "spent": 0}\n}\n\nGenerate 3-5 activities per day with realistic details.`;

        console.log('🔄 [DEBUG] Sending request to Gemini...');
        const startTime = Date.now();

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: enhancedPrompt }] }],
                generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 4096 }
            })
        });

        const duration = Date.now() - startTime;
        console.log('📥 [DEBUG] Response received in', duration, 'ms');
        console.log('📥 [DEBUG] Response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ [DEBUG] Gemini API error:');
            console.error('   Status:', response.status);
            console.error('   Error:', JSON.stringify(errorData, null, 2));

            return new Response(JSON.stringify({
                success: false,
                error: 'Gemini API returned error',
                status: response.status,
                message: errorData.error?.message || response.statusText,
                fullError: errorData
            }), { status: response.status, headers: { 'Content-Type': 'application/json' } });
        }

        const data = await response.json();
        console.log('✅ [DEBUG] Response parsed');
        console.log('🔍 [DEBUG] Has candidates:', !!data.candidates);
        console.log('🔍 [DEBUG] Candidates length:', data.candidates?.length);

        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
            console.error('❌ [DEBUG] Invalid response structure');
            return new Response(JSON.stringify({
                success: false,
                error: 'Invalid response structure',
                response: data
            }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        let responseText = data.candidates[0].content.parts[0].text;
        console.log('✅ [DEBUG] Got response text, length:', responseText.length);

        // Try to parse JSON
        responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        
        const firstBrace = responseText.indexOf('{');
        const lastBrace = responseText.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1) {
            responseText = responseText.substring(firstBrace, lastBrace + 1);
        }

        const parsedResponse = JSON.parse(responseText);
        console.log('✅ [DEBUG] JSON parsed successfully');

        return new Response(JSON.stringify({
            success: true,
            message: 'Gemini API call successful',
            duration: duration + 'ms',
            data: parsedResponse
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('❌ [DEBUG] Error:');
        console.error('   Message:', error.message);
        console.error('   Name:', error.name);
        console.error('   Stack:', error.stack);

        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            errorName: error.name,
            errorStack: error.stack
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
