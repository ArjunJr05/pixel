/**
 * Figma Token Exchange Script
 * Use this to exchange an Authorization Code for Access & Refresh Tokens
 * 
 * Usage: 
 * 1. Set FIGMA_CLIENT_ID and FIGMA_CLIENT_SECRET in .env
 * 2. Run: node get-figma-tokens.js
 * 3. Follow instructions to get code
 * 4. Run: node get-figma-tokens.js YOUR_CODE
 */

import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function exchangeTokens() {
    const authCode = process.argv[2];
    const clientId = process.env.FIGMA_CLIENT_ID;
    const clientSecret = process.env.FIGMA_CLIENT_SECRET;
    const redirectUri = process.env.FIGMA_REDIRECT_URI;

    if (!clientId || clientId.includes('PASTE')) {
        console.error('❌ Error: Figma Client ID is missing in .env');
        console.log('Please update your .env file with FIGMA_CLIENT_ID and FIGMA_CLIENT_SECRET first.');
        return;
    }

    if (!authCode) {
        console.log(`📡 Current App: ${clientId}`);
        console.log('\n--- STEPS TO GET YOUR TOKENS ---');
        console.log('1. Visit this URL in your browser:');

        const scope = 'file_content:read file_metadata:read current_user:read';
        const state = 'pixelcheck_' + Math.random().toString(36).substring(7);

        const authUrl = `https://www.figma.com/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}&response_type=code`;

        console.log(`\n👉 ${authUrl}\n`);
        console.log('2. Click "Allow Access"');
        console.log('3. You will be redirected to your site (or a 404 page).');
        console.log('4. Copy the "code=..." value from the address bar.');
        console.log('\n5. RUN THIS COMMAND NEXT:');
        console.log(`   node get-figma-tokens.js PASTE_YOUR_CODE_HERE`);
        console.log('--------------------------------\n');
        return;
    }

    console.log('🔄 Exchanging code for tokens...');

    try {
        const params = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code: authCode,
            grant_type: 'authorization_code'
        });

        const response = await axios.post('https://api.figma.com/v1/oauth/token', params.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token, refresh_token, expires_in } = response.data;

        console.log('\n✅ Tokens Received Successfully!');
        console.log('Access Token:', access_token.substring(0, 15) + '...');
        console.log('Refresh Token:', refresh_token.substring(0, 15) + '...');

        // Update .env file automatically
        const envPath = path.join(__dirname, '.env');
        let envContent = fs.readFileSync(envPath, 'utf8');

        const updates = {
            FIGMA_ACCESS_TOKEN: access_token,
            FIGMA_REFRESH_TOKEN: refresh_token
        };

        Object.entries(updates).forEach(([key, value]) => {
            const regex = new RegExp(`^${key}=.*$`, 'm');
            if (regex.test(envContent)) {
                envContent = envContent.replace(regex, `${key}=${value}`);
            } else {
                envContent += `\n${key}=${value}`;
            }
        });

        fs.writeFileSync(envPath, envContent.trim() + '\n');
        console.log('\n💾 Updated .env file automatically.');
        console.log('🚀 Your bot is now ready to use the new app!');

    } catch (error) {
        console.error('\n❌ Token Exchange Failed!');
        console.error('Error Details:', error.response?.data || error.message);
        console.log('\n💡 Tip: Codes are single-use. If it failed, get a fresh code from Step 1.');
    }
}

exchangeTokens();
