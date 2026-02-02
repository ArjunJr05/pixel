/**
 * Express server for Zoho Cliq Bot Integration
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import axios from 'axios';
import {
    handleBotMessage,
    handleFileUpload,
    generatePDFReport,
    userSessions
} from './bot-handler.js';
import { extractFeatures, compareFeatures } from '../src/utils/analyzer-node.js';
import { formatAnalysisResponse } from './response-formatter.js';

const app = express();
const PORT = process.env.BOT_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/json') {
            cb(null, true);
        } else {
            cb(new Error('Only JSON files are allowed'));
        }
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'PixelCheck Bot is running' });
});

// Zoho Cliq webhook endpoint for bot messages
app.post('/bot/message', (req, res) => {
    try {
        const { text, user } = req.body;
        const msgLower = (text || '').toLowerCase().trim();

        console.log('📨 Received message:', text, 'from user:', user?.id);

        if (msgLower.includes('start')) {
            // Return form for Figma input
            return res.json({
                text: "🎨 Let's analyze your Figma designs!",
                card: {
                    title: "PixelCheck Analysis",
                    theme: "modern-inline"
                },
                form: {
                    type: "form",
                    title: "Enter Figma Details",
                    name: "figma_input_form",
                    hint: "Provide your Figma URLs and access token",
                    button_label: "Analyze",
                    fields: [
                        {
                            type: "text",
                            name: "figma_token",
                            label: "Figma Access Token",
                            hint: "Your Figma personal access token",
                            placeholder: "figd_...",
                            mandatory: true
                        },
                        {
                            type: "text",
                            name: "android_url",
                            label: "Android Figma URL",
                            hint: "https://www.figma.com/file/...",
                            placeholder: "https://www.figma.com/file/...",
                            mandatory: true
                        },
                        {
                            type: "text",
                            name: "ios_url",
                            label: "iOS Figma URL",
                            hint: "https://www.figma.com/file/...",
                            placeholder: "https://www.figma.com/file/...",
                            mandatory: true
                        },
                        {
                            type: "text",
                            name: "web_url",
                            label: "Web Figma URL",
                            hint: "https://www.figma.com/file/...",
                            placeholder: "https://www.figma.com/file/...",
                            mandatory: true
                        }
                    ],
                    action: {
                        type: "invoke.function",
                        data: {
                            name: "analyzeFigmaDesigns"
                        }
                    }
                }
            });
        }

        return res.json({
            text: "Hi! 👋 Type **start** to begin analysis."
        });

    } catch (error) {
        console.error('Error handling bot message:', error);
        return res.json({
            text: `❌ Error: ${error.message}`
        });
    }
});

// File upload endpoint
app.post('/bot/upload', upload.single('file'), handleFileUpload);

// PDF download endpoint
app.get('/bot/download/:userId', generatePDFReport);

// Zoho Cliq bot installation handler
app.post('/bot/install', (req, res) => {
    console.log('Bot installed:', req.body);
    res.json({ success: true });
});

// Zoho Cliq bot function handler
app.post('/bot/function', async (req, res) => {
    try {
        const { name, arguments: args, user } = req.body;

        switch (name) {
            case 'uploadFile':
                return res.json({
                    type: 'form',
                    title: `Upload ${args.platform} JSON`,
                    hint: `Please select your ${args.platform} design JSON file`,
                    name: 'file_upload_form',
                    button_label: 'Upload',
                    fields: [
                        {
                            type: 'file',
                            name: 'jsonFile',
                            label: `${args.platform} JSON File`,
                            placeholder: 'Select JSON file',
                            mandatory: true
                        }
                    ],
                    action: {
                        type: 'invoke.function',
                        data: {
                            name: 'processUpload',
                            platform: args.platform
                        }
                    }
                });

            case 'processUpload':
                // This will be handled by the upload endpoint
                return res.json({
                    text: 'Processing your file...'
                });

            case 'checkStatus':
                const session = userSessions.get(user.id);
                if (!session) {
                    return res.json({
                        text: "No active session. Type 'start' to begin."
                    });
                }
                return res.json(createStatusMessage(session));

            case 'downloadPDF':
                const downloadUrl = `${process.env.BOT_URL || 'http://localhost:3001'}/bot/download/${user.id}`;
                return res.json({
                    text: `📥 [Click here to download your PDF report](${downloadUrl})`
                });

            case 'reset':
                userSessions.delete(user.id);
                return res.json({
                    text: "✅ Session reset! Type 'start' to begin a new analysis."
                });

            default:
                return res.json({
                    text: `Unknown function: ${name}`
                });
        }
    } catch (error) {
        console.error('Error handling function:', error);
        return res.json({
            text: `❌ Error: ${error.message}`
        });
    }
});

// Parse message and analyze Figma designs
app.post('/bot/parse-and-analyze', async (req, res) => {
    try {
        const { message, user_id } = req.body;

        console.log('📝 Parsing message:', message);

        // Parse the message
        const lines = message.split('\n');
        const data = {};

        lines.forEach(line => {
            if (line.includes(':')) {
                const [key, ...valueParts] = line.split(':');
                const value = valueParts.join(':').trim();
                data[key.trim().toLowerCase()] = value;
            }
        });

        console.log('📊 Parsed data:', data);

        // Validate required fields
        if (!data.token || !data.android || !data.ios || !data.web) {
            return res.json({
                text: "❌ Missing fields! Please provide:\n• token\n• android\n• ios\n• web"
            });
        }

        console.log('🔍 Fetching Figma designs...');

        // Fetch from Figma API
        const androidData = await fetchFigmaDesign(data.android, data.token);
        const iosData = await fetchFigmaDesign(data.ios, data.token);
        const webData = await fetchFigmaDesign(data.web, data.token);

        console.log('✅ Designs fetched, analyzing...');

        // Analyze
        const androidFeatures = extractFeatures(androidData.document);
        const iosFeatures = extractFeatures(iosData.document);
        const webFeatures = extractFeatures(webData.document);

        const results = compareFeatures(androidFeatures, iosFeatures, webFeatures);

        // Store in session
        userSessions.set(user_id, {
            results: results,
            timestamp: new Date()
        });

        // Calculate score
        const score = results.consistent + results.inconsistent > 0
            ? Math.round((results.consistent / (results.consistent + results.inconsistent)) * 100)
            : 0;

        console.log('✅ Analysis complete! Score:', score + '%');

        return res.json({
            text: `✅ **Analysis Complete!**\n\n📊 **Consistency Score: ${score}%**\n\n📱 Android: ${results.android.total} features (${results.android.text} text, ${results.android.buttons} buttons)\n🍎 iOS: ${results.ios.total} features (${results.ios.text} text, ${results.ios.buttons} buttons)\n🌐 Web: ${results.web.total} features (${results.web.text} text, ${results.web.buttons} buttons)\n\n✅ Consistent: ${results.consistent}\n⚠️ Inconsistent: ${results.inconsistent}\n\n📝 **Text Elements:** ${results.mapping.text.length}\n🔘 **Buttons:** ${results.mapping.buttons.length}`
        });

    } catch (error) {
        console.error('❌ Parse and analyze error:', error);

        // Check if it's a rate limit error (429)
        if (error.response && error.response.status === 429) {
            const retryAfter = error.response.headers['retry-after'];
            const hours = retryAfter ? Math.round(retryAfter / 3600) : 'unknown';

            return res.json({
                text: `⏰ **Figma API Rate Limit Exceeded**\n\n❌ You've hit Figma's API rate limit.\n\n⏱️ Retry after: ~${hours} hours\n\n**Solutions:**\n1️⃣ Wait for rate limit to reset\n2️⃣ Use different Figma token\n3️⃣ Upgrade Figma plan`
            });
        }

        return res.json({
            text: `❌ Error: ${error.message}\n\nPlease check:\n• Figma URLs are correct\n• Access token is valid\n• You have permission to access the files`
        });
    }
});

// Figma analysis endpoint
app.post('/bot/analyze-figma', async (req, res) => {
    try {
        const { figma_token, android_url, ios_url, web_url, user_id } = req.body;

        console.log('📊 Starting Figma analysis...');

        // Fetch from Figma API
        const androidData = await fetchFigmaDesign(android_url, figma_token);
        const iosData = await fetchFigmaDesign(ios_url, figma_token);
        const webData = await fetchFigmaDesign(web_url, figma_token);

        // Analyze
        const androidFeatures = extractFeatures(androidData.document);
        const iosFeatures = extractFeatures(iosData.document);
        const webFeatures = extractFeatures(webData.document);

        const results = compareFeatures(androidFeatures, iosFeatures, webFeatures);

        // Store in session
        userSessions.set(user_id, {
            results: results,
            timestamp: new Date()
        });

        // Format response
        const consistencyScore = results.consistent + results.inconsistent > 0
            ? Math.round((results.consistent / (results.consistent + results.inconsistent)) * 100)
            : 0;

        console.log('✅ Analysis complete! Score:', consistencyScore + '%');

        return res.json({
            text: `✅ **Analysis Complete!**\n\n📊 **Consistency Score: ${consistencyScore}%**\n\n📱 Android: ${results.android.total} features\n🍎 iOS: ${results.ios.total} features\n🌐 Web: ${results.web.total} features\n\n✅ Consistent: ${results.consistent}\n⚠️ Inconsistent: ${results.inconsistent}`
        });

    } catch (error) {
        console.error('❌ Figma analysis error:', error);
        return res.json({
            text: `❌ Error: ${error.message}`
        });
    }
});

// Helper function to fetch from Figma
async function fetchFigmaDesign(figmaUrl, token) {
    // Support both /file/ and /design/ URL formats
    const fileKey = figmaUrl.match(/(?:file|design)\/([a-zA-Z0-9]+)/)?.[1];
    if (!fileKey) {
        throw new Error('Invalid Figma URL format. Expected: https://www.figma.com/file/... or https://www.figma.com/design/...');
    }

    console.log('🔍 Fetching Figma file with key:', fileKey);

    const response = await axios.get(`https://api.figma.com/v1/files/${fileKey}`, {
        headers: {
            'X-Figma-Token': token
        }
    });

    return response.data;
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({
        error: error.message || 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🤖 PixelCheck Bot server running on port ${PORT}`);
    console.log(`📍 Webhook URL: http://localhost:${PORT}/bot/message`);
    console.log(`📤 Upload URL: http://localhost:${PORT}/bot/upload`);
    console.log(`📥 Download URL: http://localhost:${PORT}/bot/download/:userId`);
});

export default app;
