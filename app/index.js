export async function requestAIResponse(prompt) {
    const apiKey = 'AIzaSyB5-9D-Y-90x7okhlzSAyHshki6iRwr_do';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const enhancedPrompt = `${prompt}\n\nIMPORTANT: Respond with ONLY valid JSON matching this schema. Do not include any markdown formatting or explanatory text.\n\nRequired JSON structure:\n{\n  "tripId": "string",\n  "title": "string",\n  "startDate": "string",\n  "endDate": "string",\n  "createdBy": "string",\n  "participants": [{"name": "string", "email": "string"}],\n  "days": [{\n    "day": number,\n    "date": "string",\n    "location": "string",\n    "activities": [{\n      "time": "string",\n      "title": "string",\n      "description": "string",\n      "location": "string",\n      "notes": "string"\n    }]\n  }],\n  "notes": "string",\n  "budget": {\n    "currency": "string",\n    "estimated": number,\n    "spent": number\n  }\n}`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: enhancedPrompt
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95
            }
        }),
    });

    // console.log(response)
    // console.log(response.ok)
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to fetch from Gemini API: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const responseText = data.candidates[0].content.parts[0].text;
    return JSON.parse(responseText);
}