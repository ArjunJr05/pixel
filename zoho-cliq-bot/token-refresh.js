/**
 * Zoho OAuth Token Refresh Helper
 * Automatically refreshes expired access tokens
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

const TOKEN_FILE = path.join(process.cwd(), '.token-cache.json');

/**
 * Refresh Zoho OAuth token
 */
export async function refreshZohoToken() {
    try {
        const clientId = process.env.ZOHO_CLIENT_ID;
        const clientSecret = process.env.ZOHO_CLIENT_SECRET;
        const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

        if (!refreshToken) {
            throw new Error('ZOHO_REFRESH_TOKEN not set in .env');
        }

        console.log('🔄 Refreshing Zoho OAuth token...');

        const response = await axios.post('https://accounts.zoho.in/oauth/v2/token', null, {
            params: {
                refresh_token: refreshToken,
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'refresh_token'
            }
        });

        const newToken = response.data.access_token;

        // Cache the token
        fs.writeFileSync(TOKEN_FILE, JSON.stringify({
            access_token: newToken,
            expires_at: Date.now() + (response.data.expires_in * 1000)
        }));

        console.log('✅ Token refreshed successfully!');
        return newToken;

    } catch (error) {
        console.error('❌ Token refresh failed:', error.message);
        throw error;
    }
}

/**
 * Get valid access token (just return from env for now)
 */
export async function getValidToken() {
    // Simply return the token from environment
    // Token refresh is disabled until dotenv is properly configured
    const token = process.env.CATALYST_ACCESS_TOKEN;

    if (!token) {
        throw new Error('CATALYST_ACCESS_TOKEN not set in .env');
    }

    return token;
}
