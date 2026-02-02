/**
 * Express server for Zoho Cliq Bot Integration
 */

// Load environment variables FIRST
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import axios from 'axios';
import jsPDF from 'jspdf';
import fs from 'fs';
import {
    handleBotMessage,
    handleFileUpload,
    generatePDFReport,
    userSessions
} from './bot-handler.js';
import { extractFeatures, compareFeatures } from '../src/utils/analyzer-node.js';
import { formatAnalysisResponse } from './response-formatter.js';
import { compareComponentsWithAI } from './ai-matcher.js';
import { getFigmaAuthUrl, exchangeFigmaCode, getValidFigmaToken } from './figma-oauth.js';
import { fetchFigmaDesignFromUrl } from './figma-api.js';
import { extractHierarchicalFeatures, createCompactRepresentation } from '../src/utils/hierarchical-extractor.js';
import { analyzeWithHierarchicalAI } from './hierarchical-ai-analyzer.js';


const app = express();
const PORT = process.env.BOT_PORT || 3001;

// Create necessary directories for logging/reference
const dirs = ['./figma-json', './feature-extraction', './reports'];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Helper to save JSON data for reference
function saveJsonReference(directory, prefix, data) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${prefix}_${timestamp}.json`;
        const filePath = path.join(directory, filename);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`💾 Saved reference: ${filePath}`);
    } catch (err) {
        console.error(`❌ Failed to save reference in ${directory}:`, err.message);
    }
}

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

/**
 * Send progress message to Cliq chat
 */
/**
 * Send progress message or final result to Cliq chat
 * message can be a string or a full message object
 */
async function sendProgressMessage(chatId, message) {
    try {
        let botToken = process.env.ZOHO_OAUTH_TOKEN;
        if (!botToken) return;

        // Prepare the payload
        const payload = typeof message === 'string' ? { text: message } : message;

        const send = async (token) => {
            return axios.post(
                `https://cliq.zoho.in/api/v2/chats/${chatId}/message`,
                payload,
                {
                    headers: {
                        'Authorization': `Zoho-oauthtoken ${token}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 3000 // Increased to 3s
                }
            );
        };

        try {
            await send(botToken);
            console.log('📤 Message sent to Cliq:', typeof message === 'string' ? message : '[Complex Message]');
        } catch (err) {
            if (err.response?.status === 401) {
                console.log('🔄 Token expired during request. Refreshing...');

                const { execSync } = await import('child_process');
                try {
                    execSync('node refresh-token.js');
                    const fs = await import('fs');
                    const dotenv = await import('dotenv');
                    const envConfig = dotenv.parse(fs.readFileSync('.env'));
                    botToken = envConfig.ZOHO_OAUTH_TOKEN;

                    await send(botToken);
                    console.log('📤 Message sent successfully after refresh!');
                } catch (refreshErr) {
                    console.error('❌ Auto-refresh failed:', refreshErr.message);
                }
            } else {
                console.error('❌ Failed to send message to Cliq:', err.message);
                if (err.response?.data) {
                    console.error('📋 Zoho Error Detail:', JSON.stringify(err.response.data));
                }
            }
        }
    } catch (error) {
        // Silently continue
    }
}

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
            text: "Hi! 👋 Type `start` to begin analysis."
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




// Helper function to fetch from Figma using OAuth token
async function fetchFigmaFileWithOAuth(fileKey, token) {
    console.log('🔍 Fetching Figma file with key:', fileKey);

    const response = await axios.get(`https://api.figma.com/v1/files/${fileKey}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        },
        params: {
            depth: 10,  // Captures sufficiently nested components
            geometry: 'paths'
        },
        timeout: 60000, // 60s timeout for large files
        maxContentLength: Infinity,
        maxBodyLength: Infinity
    });

    return response.data;
}



// New endpoint: Parse message with URLs and fetch using OAuth
app.post('/bot/parse-and-analyze', async (req, res) => {
    const { message, user_id, chat_id } = req.body;

    try {
        console.log('📝 Parsing message for Figma URLs...');

        // Parse the message
        const lines = message.split('\n');
        const data = {};

        lines.forEach(line => {
            if (line.includes(':')) {
                const [key, ...valueParts] = line.split(':');
                const value = valueParts.join(':').trim();
                data[key.toLowerCase().trim()] = value;
            }
        });

        // Extract file keys from URLs
        function extractFileKey(url) {
            if (!url) return null;
            const match = url.match(/\/(design|file)\/([a-zA-Z0-9]+)/);
            return match ? match[2] : null;
        }

        const androidKey = extractFileKey(data.android);
        const iosKey = extractFileKey(data.ios);
        const webKey = extractFileKey(data.web);

        if (!androidKey || !iosKey || !webKey) {
            return res.json({
                text: '❌ Error: Could not extract file keys from URLs.\n\nMake sure URLs are in format:\nandroid: URL\nios: URL\nweb: URL'
            });
        }

        // RESPOND IMMEDIATELY TO CLIQ TO PREVENT TIMEOUT
        res.json({
            text: '⏳ Analysis Started! I\'ll process the Figma files and send the results here shortly.'
        });

        // Run the heavy lifting in "background"
        setImmediate(async () => {
            try {
                if (chat_id) {
                    await sendProgressMessage(chat_id, '🔐 Authenticating with Figma...');
                }

                const token = await getValidFigmaToken();

                if (chat_id) {
                    await sendProgressMessage(chat_id, '📥 Fetching Figma files...\n(Sequential loading to avoid rate limits)');
                }

                const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

                async function fetchWithRetry(name, key, token, retries = 3) {
                    for (let i = 0; i <= retries; i++) {
                        try {
                            console.log(`📥 Fetching ${name} file (Attempt ${i + 1}/${retries + 1})...`);
                            return await fetchFigmaFileWithOAuth(key, token);
                        } catch (error) {
                            const isNetworkError = error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND';
                            const isRateLimit = error.response?.status === 429;

                            if ((isRateLimit || isNetworkError) && i < retries) {
                                const waitTime = isRateLimit ? 30000 : 5000;
                                const reason = isRateLimit ? 'Rate limited' : `Network error (${error.code})`;

                                console.warn(`⚠️ ${reason}! Waiting ${waitTime / 1000}s...`);
                                if (chat_id) {
                                    await sendProgressMessage(chat_id, `⚠️ ${reason}. Retrying in ${waitTime / 1000}s... (Attempt ${i + 1}/${retries + 1})`);
                                }

                                await sleep(waitTime);
                                continue;
                            }
                            throw error;
                        }
                    }
                }

                const androidData = await fetchWithRetry('Android', androidKey, token);
                await sleep(5000);

                const iosData = await fetchWithRetry('iOS', iosKey, token);
                await sleep(5000);

                const webData = await fetchWithRetry('Web', webKey, token);

                // SAVE RAW FIGMA JSON
                saveJsonReference('./figma-json', 'android_raw', androidData);
                saveJsonReference('./figma-json', 'ios_raw', iosData);
                saveJsonReference('./figma-json', 'web_raw', webData);

                if (chat_id) {
                    await sendProgressMessage(chat_id, '🔍 Extracting components...');
                }

                let results;
                const useAI = process.env.ENABLE_AI_MATCHING === 'true';
                const useHierarchicalAI = process.env.ENABLE_HIERARCHICAL_AI === 'true';

                if (useHierarchicalAI) {
                    // Page-Scoped Hierarchical AI analysis
                    if (chat_id) {
                        await sendProgressMessage(chat_id, '🌳 Using Page-Scoped AI analysis...\n(Identifying features for each page)\n(Comparing functional intent)');
                    }

                    try {
                        const { extractHierarchicalFeaturesByPage } = await import('../src/utils/hierarchical-extractor.js');
                        const { analyzeWithHierarchicalAI } = await import('./hierarchical-ai-analyzer.js');

                        // Extract grouped by page
                        const androidPages = extractHierarchicalFeaturesByPage(androidData.document);
                        const iosPages = extractHierarchicalFeaturesByPage(iosData.document);
                        const webPages = extractHierarchicalFeaturesByPage(webData.document);

                        // SAVE FOR REFERENCE
                        saveJsonReference('./feature-extraction', 'android_pages', androidPages);
                        saveJsonReference('./feature-extraction', 'ios_pages', iosPages);
                        saveJsonReference('./feature-extraction', 'web_pages', webPages);

                        // Page-scoped AI analysis
                        results = await analyzeWithHierarchicalAI(androidPages, iosPages, webPages);

                    } catch (error) {
                        console.error('❌ Page-scoped AI failed:', error.message);
                        console.log('⚠️ Falling back to basic match...');

                        const { extractHierarchicalFeatures } = await import('../src/utils/hierarchical-extractor.js');
                        const androidHierarchical = extractHierarchicalFeatures(androidData.document);
                        const iosHierarchical = extractHierarchicalFeatures(iosData.document);
                        const webHierarchical = extractHierarchicalFeatures(webData.document);

                        const allNames = new Set([
                            ...androidHierarchical.cards.map(c => c.name),
                            ...iosHierarchical.cards.map(c => c.name),
                            ...webHierarchical.cards.map(c => c.name)
                        ]);

                        const matches = [];
                        allNames.forEach(name => {
                            const android = androidHierarchical.cards.find(c => c.name === name);
                            const ios = iosHierarchical.cards.find(c => c.name === name);
                            const web = webHierarchical.cards.find(c => c.name === name);
                            const platforms = [];
                            if (android) platforms.push('Android');
                            if (ios) platforms.push('iOS');
                            if (web) platforms.push('Web');
                            const original = android || ios || web;
                            matches.push({
                                name: name,
                                platforms: platforms.join(', '),
                                countInfo: platforms.length === 3 ? 'Present on all' : `Missing from: ${['Android', 'iOS', 'Web'].filter(p => !platforms.includes(p)).join(', ')}`,
                                icon: platforms.length === 3 ? '✅' : '⚠️',
                                details: platforms.length === 3 ? '✅ Present on all platforms' : `Missing from: ${['Android', 'iOS', 'Web'].filter(p => !platforms.includes(p)).join(', ')}`,
                                detailedString: original.detailedString
                            });
                        });

                        results = {
                            android: { total: androidHierarchical.cards.length },
                            ios: { total: iosHierarchical.cards.length },
                            web: { total: webHierarchical.cards.length },
                            consistent: matches.filter(m => m.platforms.split(', ').length === 3).length,
                            inconsistent: matches.filter(m => m.platforms.split(', ').length < 3).length,
                            mapping: { text: matches, buttons: [], recipes: [] }
                        };
                    }
                } else if (useAI) {
                    // Existing: Batch AI matching
                    if (chat_id) {
                        await sendProgressMessage(chat_id, '🤖 Using AI to match structures...\n(Analyzing component recipes)');
                    }

                    const androidFeatures = extractFeatures(androidData.document);
                    const iosFeatures = extractFeatures(iosData.document);
                    const webFeatures = extractFeatures(webData.document);

                    // SAVE EXTRACTED FEATURES
                    saveJsonReference('./feature-extraction', 'android_batch_features', androidFeatures);
                    saveJsonReference('./feature-extraction', 'ios_batch_features', iosFeatures);
                    saveJsonReference('./feature-extraction', 'web_batch_features', webFeatures);

                    try {
                        results = await compareComponentsWithAI(
                            androidFeatures.groups,
                            iosFeatures.groups,
                            webFeatures.groups
                        );
                    } catch (error) {
                        console.error('❌ AI matching failed:', error.message);
                        results = compareFeatures(androidFeatures, iosFeatures, webFeatures);
                    }
                } else {
                    // Basic: Structural matching only
                    const androidFeatures = extractFeatures(androidData.document);
                    const iosFeatures = extractFeatures(iosData.document);
                    const webFeatures = extractFeatures(webData.document);

                    // SAVE EXTRACTED FEATURES
                    saveJsonReference('./feature-extraction', 'android_basic_features', androidFeatures);
                    saveJsonReference('./feature-extraction', 'ios_basic_features', iosFeatures);
                    saveJsonReference('./feature-extraction', 'web_basic_features', webFeatures);

                    results = compareFeatures(androidFeatures, iosFeatures, webFeatures);
                }

                // Store in session
                userSessions.set(user_id, {
                    results: results,
                    timestamp: new Date()
                });

                // Generate PDF
                try {
                    await generatePDFReport(results, user_id);
                } catch (pdfError) {
                    console.error('❌ PDF generation failed:', pdfError);
                }

                // Format and send FINAL results via Cliq API
                const formattedResponse = formatAnalysisResponse(results, user_id, process.env.BOT_URL);

                if (chat_id) {
                    await sendProgressMessage(chat_id, formattedResponse);
                    await sendProgressMessage(chat_id, '🏁 Analysis complete!');
                }

                console.log('\n🏁 ANALYSIS COMPLETE');
                console.log('📥 PDF DOWNLOAD LINK:', `${process.env.BOT_URL}/bot/download/${user_id}\n`);

            } catch (bgError) {
                console.error('❌ Background analysis error:', bgError);
                if (chat_id) {
                    await sendProgressMessage(chat_id, '❌ Error during analysis: ' + bgError.message);
                }
            }
        });

    } catch (error) {
        console.error('❌ Error in initial parse:', error);
        return res.json({
            text: '❌ Error: ' + error.message
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({
        error: error.message || 'Internal server error'
    });
});

// New endpoint: Analyze designs with pre-fetched Figma data (from Deluge connection)
app.post('/bot/analyze-designs', async (req, res) => {
    try {
        const { android_data, ios_data, web_data, user_id, chat_id } = req.body;

        console.log('📊 Analyzing pre-fetched Figma designs...');

        if (chat_id) {
            await sendProgressMessage(chat_id, '⏳ Starting analysis...');
        }

        // Extract features from the already-fetched data
        const androidFeatures = extractFeatures(android_data.document);
        const iosFeatures = extractFeatures(ios_data.document);
        const webFeatures = extractFeatures(web_data.document);

        if (chat_id) {
            await sendProgressMessage(chat_id, '🔍 Extracting components...');
        }

        // Use AI matching if enabled
        let results;
        const useAI = process.env.ENABLE_AI_MATCHING === 'true';

        if (useAI) {
            console.log('🤖 Using AI-powered semantic matching...');

            if (chat_id) {
                await sendProgressMessage(chat_id, '🤖 Using AI to match components...\n(This may take a moment)');
            }

            try {
                results = await compareComponentsWithAI(
                    androidFeatures.text,
                    iosFeatures.text,
                    webFeatures.text
                );
                console.log('✅ AI analysis complete');

                if (chat_id) {
                    await sendProgressMessage(chat_id, '✅ AI analysis complete!\n📊 Generating report...');
                }
            } catch (error) {
                console.error('❌ AI matching failed, falling back to exact matching:', error.message);

                if (chat_id) {
                    await sendProgressMessage(chat_id, '⚠️ AI failed, using exact matching...');
                }

                results = compareFeatures(androidFeatures, iosFeatures, webFeatures);
            }
        } else {
            console.log('📊 Using exact text matching...');

            if (chat_id) {
                await sendProgressMessage(chat_id, '📊 Comparing components...');
            }

            results = compareFeatures(androidFeatures, iosFeatures, webFeatures);
        }

        // Store in session
        userSessions.set(user_id, {
            results: results,
            timestamp: new Date()
        });

        // Calculate score
        const score = results.consistent + results.inconsistent > 0
            ? Math.round((results.consistent / (results.consistent + results.inconsistent)) * 100)
            : 0;

        // Generate PDF
        try {
            const reportPath = await generatePDFReport(results, user_id);
            console.log('📄 PDF generated:', reportPath);
        } catch (pdfError) {
            console.error('❌ PDF generation failed:', pdfError);
        }

        // Format and return response
        const formattedResponse = formatAnalysisResponse(results, score);
        return res.json(formattedResponse);

    } catch (error) {
        console.error('❌ Analysis error:', error);
        return res.json({
            text: `❌ Error: ${error.message}`
        });
    }
});




// ============================================
// FIGMA OAUTH ENDPOINTS
// ============================================

// Step 1: Initiate Figma OAuth flow
app.get('/oauth/figma/start', (req, res) => {
    const state = Math.random().toString(36).substring(7);
    const authUrl = getFigmaAuthUrl(state);

    console.log('🔐 Starting Figma OAuth flow...');
    console.log('📍 Redirect to:', authUrl);

    res.redirect(authUrl);
});

// Step 2: Handle Figma OAuth callback
app.get('/oauth/figma/callback', async (req, res) => {
    try {
        const { code, state } = req.query;

        if (!code) {
            return res.status(400).send('❌ No authorization code received');
        }

        console.log('✅ Received Figma authorization code');
        console.log('🔄 Exchanging code for tokens...');

        // Exchange code for tokens
        const tokenData = await exchangeFigmaCode(code);

        res.send(`
            <html>
                <head>
                    <title>Figma OAuth Success</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        }
                        .container {
                            background: white;
                            padding: 40px;
                            border-radius: 10px;
                            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                            text-align: center;
                            max-width: 500px;
                        }
                        h1 { color: #1e1e1e; margin-bottom: 20px; }
                        p { color: #666; line-height: 1.6; }
                        .success { color: #10b981; font-size: 48px; margin-bottom: 20px; }
                        .info { background: #f3f4f6; padding: 15px; border-radius: 5px; margin-top: 20px; }
                        .token { font-family: monospace; font-size: 12px; word-break: break-all; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="success">✅</div>
                        <h1>Figma OAuth Successful!</h1>
                        <p>Your Figma account has been connected successfully.</p>
                        <div class="info">
                            <p><strong>Access Token:</strong></p>
                            <p class="token">${tokenData.access_token.substring(0, 20)}...</p>
                            <p style="margin-top: 15px;"><strong>Token expires in:</strong> ${Math.floor(tokenData.expires_in / 86400)} days</p>
                        </div>
                        <p style="margin-top: 20px;">Tokens have been saved to your .env file.</p>
                        <p>You can close this window and return to your bot.</p>
                    </div>
                </body>
            </html>
        `);

    } catch (error) {
        console.error('❌ OAuth callback error:', error);
        res.status(500).send(`
            <html>
                <head><title>OAuth Error</title></head>
                <body style="font-family: Arial; padding: 40px; text-align: center;">
                    <h1 style="color: #ef4444;">❌ OAuth Error</h1>
                    <p>${error.message}</p>
                    <p>Please try again or check your configuration.</p>
                </body>
            </html>
        `);
    }
});

// Test endpoint to check Figma token
app.get('/oauth/figma/test', async (req, res) => {
    try {
        const token = await getValidFigmaToken();
        res.json({
            success: true,
            message: 'Figma token is valid',
            token_preview: token.substring(0, 20) + '...'
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            error: error.message
        });
    }
});

// Start server

app.listen(PORT, () => {
    console.log(`🤖 PixelCheck Bot server running on port ${PORT}`);
    console.log(`📍 Webhook URL: http://localhost:${PORT}/bot/message`);
    console.log(`📤 Upload URL: http://localhost:${PORT}/bot/upload`);
    console.log(`📥 Download URL: http://localhost:${PORT}/bot/download/:userId`);
});

export default app;
