import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Figma OAuth Configuration
const FIGMA_CLIENT_ID = process.env.FIGMA_CLIENT_ID;
const FIGMA_CLIENT_SECRET = process.env.FIGMA_CLIENT_SECRET;
const FIGMA_REDIRECT_URI = process.env.FIGMA_REDIRECT_URI || 'http://localhost:3001/oauth/figma/callback';
const FIGMA_TOKEN_URL = 'https://api.figma.com/v1/oauth/token';
const FIGMA_REFRESH_URL = 'https://api.figma.com/v1/oauth/refresh';

// Token cache
let tokenCache = {
    access_token: process.env.FIGMA_ACCESS_TOKEN || null,
    refresh_token: process.env.FIGMA_REFRESH_TOKEN || null,
    expires_at: null
};

/**
 * Get authorization URL for Figma OAuth
 * @param {string} state - Random state for CSRF protection
 * @returns {string} Authorization URL
 */
export function getFigmaAuthUrl(state) {
    // Scopes needed for PixelCheck bot (Updated to match your screenshot):
    const scopes = ['file_content:read', 'file_metadata:read', 'current_user:read'];

    const params = new URLSearchParams({
        client_id: FIGMA_CLIENT_ID,
        redirect_uri: FIGMA_REDIRECT_URI,
        scope: scopes.join(' '),
        state: state,
        response_type: 'code'
    });

    return `https://www.figma.com/oauth?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 * @param {string} code - Authorization code from OAuth callback
 * @returns {Promise<Object>} Token response
 */
export async function exchangeFigmaCode(code) {
    try {
        // Create Basic Auth header
        const credentials = Buffer.from(`${FIGMA_CLIENT_ID}:${FIGMA_CLIENT_SECRET}`).toString('base64');

        const params = new URLSearchParams({
            redirect_uri: FIGMA_REDIRECT_URI,
            code: code,
            grant_type: 'authorization_code'
        });

        const response = await axios.post(FIGMA_TOKEN_URL, params.toString(), {
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token, refresh_token, expires_in } = response.data;

        // Calculate expiration time (90 days by default)
        const expires_at = Date.now() + (expires_in * 1000);

        // Update cache
        tokenCache = {
            access_token,
            refresh_token,
            expires_at
        };

        // Save to .env file
        updateEnvFile({
            FIGMA_ACCESS_TOKEN: access_token,
            FIGMA_REFRESH_TOKEN: refresh_token
        });

        console.log('✅ Figma OAuth tokens obtained successfully!');
        console.log(`📅 Token expires in ${Math.floor(expires_in / 86400)} days`);

        return response.data;

    } catch (error) {
        console.error('❌ Error exchanging Figma code:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Refresh Figma access token
 * @returns {Promise<string>} New access token
 */
export async function refreshFigmaToken() {
    try {
        if (!tokenCache.refresh_token) {
            throw new Error('No refresh token available');
        }

        console.log('🔄 Refreshing Figma access token...');

        // Create Basic Auth header
        const credentials = Buffer.from(`${FIGMA_CLIENT_ID}:${FIGMA_CLIENT_SECRET}`).toString('base64');

        const params = new URLSearchParams({
            refresh_token: tokenCache.refresh_token
        });

        const response = await axios.post(FIGMA_REFRESH_URL, params.toString(), {
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token, expires_in } = response.data;

        // Calculate expiration time
        const expires_at = Date.now() + (expires_in * 1000);

        // Update cache
        tokenCache.access_token = access_token;
        tokenCache.expires_at = expires_at;

        // Update .env file
        updateEnvFile({
            FIGMA_ACCESS_TOKEN: access_token
        });

        console.log('✅ Figma token refreshed successfully!');
        console.log(`📅 New token expires in ${Math.floor(expires_in / 86400)} days`);

        return access_token;

    } catch (error) {
        console.error('❌ Error refreshing Figma token:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Get valid Figma access token (auto-refresh if needed)
 * @returns {Promise<string>} Valid access token
 */
export async function getValidFigmaToken() {
    // Load from environment if cache is empty
    if (!tokenCache.access_token && process.env.FIGMA_ACCESS_TOKEN) {
        console.log('📥 Loading Figma token from environment...');
        tokenCache.access_token = process.env.FIGMA_ACCESS_TOKEN;
        tokenCache.refresh_token = process.env.FIGMA_REFRESH_TOKEN;
    }

    // Check if token exists
    if (!tokenCache.access_token) {
        throw new Error('No Figma access token available. Please authenticate first.');
    }

    // Check if token is expired or will expire in next 24 hours
    const oneDayFromNow = Date.now() + (24 * 60 * 60 * 1000);

    if (tokenCache.expires_at && tokenCache.expires_at < oneDayFromNow) {
        console.log('⚠️ Figma token expired or expiring soon, refreshing...');
        return await refreshFigmaToken();
    }

    return tokenCache.access_token;
}

/**
 * Update .env file with new tokens
 * @param {Object} updates - Key-value pairs to update
 */
function updateEnvFile(updates) {
    try {
        const envPath = path.join(__dirname, '.env');
        let envContent = '';

        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }

        // Update each key
        Object.entries(updates).forEach(([key, value]) => {
            const regex = new RegExp(`^${key}=.*$`, 'm');
            if (regex.test(envContent)) {
                envContent = envContent.replace(regex, `${key}=${value}`);
            } else {
                envContent += `\n${key}=${value}`;
            }
        });

        fs.writeFileSync(envPath, envContent.trim() + '\n');
        console.log('✅ .env file updated');

    } catch (error) {
        console.error('❌ Error updating .env file:', error.message);
    }
}

export default {
    getFigmaAuthUrl,
    exchangeFigmaCode,
    refreshFigmaToken,
    getValidFigmaToken
};
