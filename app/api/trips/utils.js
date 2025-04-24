export async function requestAIResponse(prompt) {
    const endpoint = 'http://127.0.0.1:11434/api/generate';
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'llama3.2',
            prompt,
            stream: false,
            format: {
                '$schema': 'http://json-schema.org/draft-04/schema#',
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    startDate: { type: 'string' },
                    endDate: { type: 'string' },
                    createdBy: { type: 'string' },
                    participants: {
                        type: 'array',
                        items: [
                            {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    email: { type: 'string' },
                                },
                                required: ['name', 'email'],
                            },
                            {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    email: { type: 'string' },
                                },
                                required: ['name', 'email'],
                            },
                        ],
                    },
                    days: {
                        type: 'array',
                        items: [
                            {
                                type: 'object',
                                properties: {
                                    day: { type: 'integer' },
                                    date: { type: 'string' },
                                    location: { type: 'string' },
                                    activities: {
                                        type: 'array',
                                        minItems: 3,
                                        items: [
                                            {
                                                type: 'object',
                                                properties: {
                                                    time: { type: 'string' },
                                                    title: { type: 'string' },
                                                    description: { type: 'string' },
                                                    location: { type: 'string' },
                                                    notes: { type: 'string' },
                                                },
                                                required: ['time', 'title', 'description', 'location', 'notes'],
                                            },
                                        ],
                                    },
                                },
                                required: ['day', 'date', 'location', 'activities'],
                            },
                            {
                                type: 'object',
                                properties: {
                                    day: { type: 'integer' },
                                    date: { type: 'string' },
                                    location: { type: 'string' },
                                    activities: {
                                        type: 'array',
                                        items: [
                                            {
                                                type: 'object',
                                                properties: {
                                                    time: { type: 'string' },
                                                    title: { type: 'string' },
                                                    location: { type: 'string' },
                                                    notes: { type: 'string' },
                                                },
                                                required: ['time', 'title', 'location', 'notes'],
                                            },
                                        ],
                                    },
                                },
                                required: ['day', 'date', 'location', 'activities'],
                            },
                        ],
                    },
                    notes: { type: 'string' },
                    budget: {
                        type: 'object',
                        properties: {
                            currency: { type: 'string' },
                            estimated: { type: 'integer' },
                            spent: { type: 'integer' },
                        },
                        required: ['currency', 'estimated', 'spent'],
                    },
                },
                required: ['tripId', 'title', 'startDate', 'endDate', 'createdBy', 'participants', 'days', 'notes', 'budget'],
            },
        }),
    });

    // console.log(response)
    // console.log(response.ok)
    if (!response.ok) {
        throw new Error('Failed to fetch from Ollama API');
    }

    const data = await response.json();
    return JSON.parse(data.response);
}
