export async function requestAIResponse(prompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    
    // Debug: Check if API key is set
    console.log('🔍 [GEMINI] Initializing API call');
    console.log('🔍 [GEMINI] API Key present:', !!apiKey);
    console.log('🔍 [GEMINI] Environment:', process.env.NODE_ENV);
    
    if (!apiKey) {
        console.error('❌ [GEMINI] API Key is missing! Check environment variables.');
        throw new Error('Gemini API key not configured. Set GEMINI_API_KEY environment variable.');
    }
    
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const enhancedPrompt = `${prompt}\n\nRespond with ONLY valid JSON. No markdown, no code blocks, no explanatory text.\n\nRequired structure:\n{\n  "title": "string",\n  "destination": "string",\n  "startDate": "string (YYYY-MM-DD)",\n  "endDate": "string (YYYY-MM-DD)",\n  "createdBy": "string",\n  "participants": [{"name": "string", "email": "string"}],\n  "days": [{\n    "day": number,\n    "date": "string (YYYY-MM-DD)",\n    "location": "string",\n    "activities": [{\n      "time": "string",\n      "title": "string",\n      "description": "string",\n      "location": "string",\n      "notes": "string"\n    }]\n  }],\n  "notes": "string",\n  "budget": {"currency": "string", "estimated": number, "spent": 0}\n}\n\nGenerate 3-5 activities per day with realistic details.`;

    try {
        console.log('📤 [GEMINI] Sending request to Gemini API');
        console.log('📤 [GEMINI] Prompt length:', enhancedPrompt.length);
        console.log('📤 [GEMINI] Endpoint:', endpoint.replace(apiKey, '***'));
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: enhancedPrompt }] }],
                generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 4096 }
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        console.log('📥 [GEMINI] Response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ [GEMINI] API returned error:');
            console.error('   Status:', response.status);
            console.error('   Status Text:', response.statusText);
            console.error('   Error:', JSON.stringify(errorData, null, 2));
            
            if (response.status === 401 || response.status === 403) {
                const errorMsg = errorData.error?.message || 'Invalid API key or insufficient permissions';
                
                // Check for specific error messages
                if (errorMsg.includes('leaked')) {
                    throw new Error(`Gemini API authentication failed: Your API key was reported as leaked. Please generate a new API key at https://aistudio.google.com/apikey`);
                } else if (errorMsg.includes('quota')) {
                    throw new Error(`Gemini API quota exceeded. Please upgrade your plan or wait before retrying.`);
                } else {
                    throw new Error(`Gemini API authentication failed: ${errorMsg}`);
                }
            } else if (response.status === 429) {
                throw new Error('Gemini API rate limit exceeded. Please try again later.');
            } else if (response.status === 500) {
                throw new Error('Gemini API server error. Please try again later.');
            } else {
                throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
            }
        }

        const data = await response.json();
        
        console.log('✅ [GEMINI] Response received successfully');
        console.log('🔍 [GEMINI] Response structure:', {
            hasCandidates: !!data.candidates,
            candidatesLength: data.candidates?.length,
            hasContent: !!data.candidates?.[0]?.content,
            hasText: !!data.candidates?.[0]?.content?.parts?.[0]?.text
        });
        
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
            console.error('❌ [GEMINI] Invalid response structure');
            console.error('   Full response:', JSON.stringify(data, null, 2));
            throw new Error('Invalid response from Gemini API - missing text content');
        }
        
        let responseText = data.candidates[0].content.parts[0].text;
        console.log('🔍 [GEMINI] Raw response text length:', responseText.length);
        console.log('🔍 [GEMINI] First 100 chars:', responseText.substring(0, 100));
        
        responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        
        const firstBrace = responseText.indexOf('{');
        const lastBrace = responseText.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1) {
            responseText = responseText.substring(firstBrace, lastBrace + 1);
        }
        
        console.log('🔍 [GEMINI] Cleaned response length:', responseText.length);
        
        const parsedResponse = JSON.parse(responseText);
        console.log('✅ [GEMINI] JSON parsed successfully');
        console.log('🔍 [GEMINI] Parsed structure:', {
            hasTitle: !!parsedResponse.title,
            hasDestination: !!parsedResponse.destination,
            daysCount: parsedResponse.days?.length || 0
        });
        
        return parsedResponse;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('❌ [GEMINI] Request timeout (30 seconds exceeded)');
            throw new Error('Gemini API request timed out. The service took too long to respond.');
        }
        
        console.error('❌ [GEMINI] Error in requestAIResponse:');
        console.error('   Name:', error.name);
        console.error('   Message:', error.message);
        console.error('   Stack:', error.stack);
        throw error;
    }
}
