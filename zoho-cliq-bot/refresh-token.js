/**
 * Manual Token Refresh Script
 * Refreshes tokens for both Zoho Cliq (App: Sha) and Zoho Catalyst (App: PixelClientBot)
 */

import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '.env');

async function refreshToken(name, clientId, clientSecret, refresh_token) {
    console.log(`\n🔄 Refreshing Token for ${name}...`);
    console.log(`Client ID: ${clientId}`);
    console.log(`Using Refresh Token: ${refresh_token.substring(0, 10)}...`);

    if (!clientId || !clientSecret || !refresh_token) {
        throw new Error(`Missing credentials for ${name} in .env`);
    }

    const params = new URLSearchParams({
        refresh_token: refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token'
    });

    const response = await axios.post('https://accounts.zoho.in/oauth/v2/token', params.toString(), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });

    if (response.data.error) {
        throw new Error(`Zoho API Error: ${response.data.error}`);
    }

    const accessToken = response.data.access_token;
    if (!accessToken) {
        throw new Error('No access_token found in response body');
    }

    console.log(`✅ ${name} Token Refreshed Successfully!`);
    return accessToken;
}

async function run() {
    try {
        // Use the "Sha" app (ZOHO_CLIENT_ID) for both services as it has all scopes
        const token = await refreshToken(
            'Zoho (Unified App)',
            process.env.ZOHO_CLIENT_ID,
            process.env.ZOHO_CLIENT_SECRET,
            process.env.ZOHO_REFRESH_TOKEN
        );

        if (token) {
            console.log('Writing to .env...');
            let envContent = fs.readFileSync(envPath, 'utf8');

            // Update both tokens in the file
            envContent = envContent.replace(/ZOHO_OAUTH_TOKEN=[^\r\n]*/, `ZOHO_OAUTH_TOKEN=${token}`);
            envContent = envContent.replace(/CATALYST_ACCESS_TOKEN=[^\r\n]*/, `CATALYST_ACCESS_TOKEN=${token}`);

            fs.writeFileSync(envPath, envContent);
            console.log('💾 Updated .env file with new access tokens.');
        }
    } catch (err) {
        console.error('❌ Critical Error in run():', err.message);
        if (err.response && err.response.data) {
            console.error('📋 Zoho Error Response:', JSON.stringify(err.response.data));
        }
        process.exit(1); // Ensure exit code is 1 for execSync to catch
    }
}

run();
