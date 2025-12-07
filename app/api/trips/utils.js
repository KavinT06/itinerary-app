export async function requestAIResponse(prompt) {
    const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyB5-9D-Y-90x7okhlzSAyHshki6iRwr_do';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const enhancedPrompt = `${prompt}\n\nRespond with ONLY valid JSON. No markdown, no code blocks, no explanatory text.\n\nRequired structure:\n{\n  "title": "string",\n  "destination": "string",\n  "startDate": "string (YYYY-MM-DD)",\n  "endDate": "string (YYYY-MM-DD)",\n  "createdBy": "string",\n  "participants": [{"name": "string", "email": "string"}],\n  "days": [{\n    "day": number,\n    "date": "string (YYYY-MM-DD)",\n    "location": "string",\n    "activities": [{\n      "time": "string",\n      "title": "string",\n      "description": "string",\n      "location": "string",\n      "notes": "string"\n    }]\n  }],\n  "notes": "string",\n  "budget": {"currency": "string", "estimated": number, "spent": 0}\n}\n\nGenerate 3-5 activities per day with realistic details.`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: enhancedPrompt }] }],
                generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 4096 }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Gemini API error:', errorData);
            throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
            console.error('Invalid API response:', data);
            throw new Error('Invalid response from Gemini API');
        }
        
        let responseText = data.candidates[0].content.parts[0].text;
        responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        
        const firstBrace = responseText.indexOf('{');
        const lastBrace = responseText.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1) {
            responseText = responseText.substring(firstBrace, lastBrace + 1);
        }
        
        return JSON.parse(responseText);
    } catch (error) {
        console.error('Error in requestAIResponse:', error.message);
        throw error;
    }
}
