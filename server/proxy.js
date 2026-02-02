// Backend Proxy Server for Zoho Catalyst QuickML API
// This solves the CORS issue by proxying requests from the browser

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = 3001;

// Enable CORS for your frontend
app.use(cors({
    origin: 'http://localhost:5173', // Vite default port
    credentials: true
}));

app.use(express.json({ limit: '50mb' })); // Support large base64 images

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Proxy server is running' });
});

// Proxy endpoint for QuickML Vision API
app.post('/api/quickml/analyze', async (req, res) => {
    try {
        const { prompt, images, authToken, orgId } = req.body;

        if (!authToken || !orgId) {
            return res.status(400).json({
                error: 'Missing required parameters: authToken and orgId'
            });
        }

        const quickMLEndpoint = 'https://api.catalyst.zoho.in/quickml/v1/project/28618000000011083/vlm/chat';

        const payload = {
            prompt: prompt || 'Analyze this UI design and identify all interactive components.',
            model: 'VL-Qwen2.5-7B',
            images: images || [],
            system_prompt: 'You are a UI/UX expert analyzing mobile and web interfaces. Be precise and structured in your analysis.',
            top_k: 50,
            top_p: 0.9,
            temperature: 0.7,
            max_tokens: 2000
        };

        console.log('Proxying request to Zoho Catalyst QuickML Vision...');

        const response = await fetch(quickMLEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Zoho-oauthtoken ${authToken}`,
                'CATALYST-ORG': orgId
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('QuickML API Error:', response.status, errorText);
            return res.status(response.status).json({
                error: `QuickML API error: ${response.status}`,
                details: errorText
            });
        }

        const data = await response.json();
        console.log('QuickML API Success');
        res.json(data);

    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({
            error: 'Proxy server error',
            message: error.message
        });
    }
});

// Proxy endpoint for QuickML LLM API (JSON-based analysis - CORRECT FLOW)
app.post('/api/quickml/llm', async (req, res) => {
    try {
        const { prompt, system_prompt, authToken, orgId, model, max_tokens } = req.body;

        if (!authToken || !orgId) {
            return res.status(400).json({
                error: 'Missing required parameters: authToken and orgId'
            });
        }

        const quickMLLLMEndpoint = 'https://api.catalyst.zoho.in/quickml/v2/project/28618000000011083/llm/chat';

        const payload = {
            prompt: prompt,
            model: model || 'crm-di-qwen_text_14b-fp8-it',
            system_prompt: system_prompt || 'You are a helpful assistant.',
            top_p: 0.9,
            top_k: 50,
            best_of: 1,
            temperature: 0.7,
            max_tokens: max_tokens || 2000
        };

        console.log('Proxying request to Zoho Catalyst QuickML LLM...');
        console.log('Model:', payload.model);
        console.log('Prompt length:', prompt.length);

        const response = await fetch(quickMLLLMEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Zoho-oauthtoken ${authToken}`,
                'CATALYST-ORG': orgId
            },
            body: JSON.stringify(payload)
        });

        console.log('QuickML LLM API status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('QuickML LLM API Error:', response.status, errorText);
            return res.status(response.status).json({
                error: `QuickML LLM API error: ${response.status}`,
                details: errorText
            });
        }

        const data = await response.json();
        console.log('QuickML LLM API Success');
        res.json(data);

    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({
            error: 'Proxy server error',
            message: error.message
        });
    }
});

// Proxy endpoint for Figma API (to avoid CORS issues)
app.get('/api/figma/images/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const { nodeId, accessToken } = req.query;

        if (!accessToken) {
            return res.status(400).json({ error: 'Missing Figma access token' });
        }

        const url = `https://api.figma.com/v1/images/${fileId}?ids=${nodeId}&format=png&scale=2`;

        const response = await fetch(url, {
            headers: {
                'X-Figma-Token': accessToken
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({
                error: `Figma API error: ${response.status}`,
                details: errorText
            });
        }

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error('Figma Proxy Error:', error);
        res.status(500).json({
            error: 'Proxy server error',
            message: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Proxy server running on http://localhost:${PORT}`);
    console.log(`📡 Ready to proxy requests to Zoho Catalyst QuickML`);
    console.log(`🔒 CORS enabled for http://localhost:5173`);
});
