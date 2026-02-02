// Automatic Token Management for Zoho Catalyst QuickML
// Handles token refresh and expiration

const TOKEN_CONFIG = {
    // Zoho OAuth credentials (from your Postman screenshot)
    clientId: '1000.L01STMC362C0ST79VYLEH1KCJBLLF',
    clientSecret: 'b6cd1527ceba8e65ce54218e313abd0f6b51ff12600',
    refreshToken: '1000.92bbb56d52b375b826197f707a9a6cce.a2a6edf804d30258a73440811080d088',

    // Token storage
    accessToken: null,
    expiresAt: null,

    // Zoho OAuth endpoint
    tokenEndpoint: 'https://accounts.zoho.in/oauth/v2/token'
}

/**
 * Refreshes the Zoho OAuth access token
 * @returns {Promise<string>} New access token
 */
export async function refreshZohoToken() {
    console.log('🔄 Refreshing Zoho OAuth token...')

    const params = new URLSearchParams({
        client_id: TOKEN_CONFIG.clientId,
        client_secret: TOKEN_CONFIG.clientSecret,
        refresh_token: TOKEN_CONFIG.refreshToken,
        grant_type: 'refresh_token'
    })

    try {
        const response = await fetch(TOKEN_CONFIG.tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Token refresh failed (${response.status}): ${errorText}`)
        }

        const data = await response.json()

        // Store new token and expiration time
        TOKEN_CONFIG.accessToken = data.access_token
        TOKEN_CONFIG.expiresAt = Date.now() + (data.expires_in * 1000) - 60000 // Refresh 1 min before expiry

        console.log('✅ Token refreshed successfully')
        console.log('⏰ Expires in:', data.expires_in, 'seconds')

        return data.access_token
    } catch (error) {
        console.error('❌ Token refresh failed:', error)
        throw error
    }
}

/**
 * Gets a valid access token, refreshing if necessary
 * @returns {Promise<string>} Valid access token
 */
export async function getValidToken() {
    // Check if token exists and is not expired
    if (TOKEN_CONFIG.accessToken && Date.now() < TOKEN_CONFIG.expiresAt) {
        console.log('✓ Using cached token')
        return TOKEN_CONFIG.accessToken
    }

    // Token expired or doesn't exist, refresh it
    console.log('⚠️ Token expired or missing, refreshing...')
    return await refreshZohoToken()
}

/**
 * Checks if current token is valid
 * @returns {boolean} True if token is valid
 */
export function isTokenValid() {
    return TOKEN_CONFIG.accessToken && Date.now() < TOKEN_CONFIG.expiresAt
}

/**
 * Manually set token (for initial setup)
 * @param {string} token - Access token
 * @param {number} expiresIn - Expiration time in seconds
 */
export function setToken(token, expiresIn = 3600) {
    TOKEN_CONFIG.accessToken = token
    TOKEN_CONFIG.expiresAt = Date.now() + (expiresIn * 1000) - 60000
    console.log('✅ Token set manually')
}

/**
 * Update refresh token credentials
 * @param {Object} credentials - OAuth credentials
 */
export function updateCredentials(credentials) {
    if (credentials.clientId) TOKEN_CONFIG.clientId = credentials.clientId
    if (credentials.clientSecret) TOKEN_CONFIG.clientSecret = credentials.clientSecret
    if (credentials.refreshToken) TOKEN_CONFIG.refreshToken = credentials.refreshToken
    console.log('✅ Credentials updated')
}

/**
 * Get current token info (for debugging)
 */
export function getTokenInfo() {
    return {
        hasToken: !!TOKEN_CONFIG.accessToken,
        isValid: isTokenValid(),
        expiresIn: TOKEN_CONFIG.expiresAt ? Math.floor((TOKEN_CONFIG.expiresAt - Date.now()) / 1000) : 0
    }
}

// Auto-refresh token every 50 minutes (tokens typically expire in 1 hour)
let autoRefreshInterval = null

/**
 * Start automatic token refresh
 */
export function startAutoRefresh() {
    if (autoRefreshInterval) {
        console.log('⚠️ Auto-refresh already running')
        return
    }

    console.log('🔄 Starting automatic token refresh (every 50 minutes)')

    // Refresh immediately
    refreshZohoToken().catch(err => {
        console.error('Initial token refresh failed:', err)
    })

    // Then refresh every 50 minutes
    autoRefreshInterval = setInterval(() => {
        refreshZohoToken().catch(err => {
            console.error('Auto token refresh failed:', err)
        })
    }, 50 * 60 * 1000) // 50 minutes
}

/**
 * Stop automatic token refresh
 */
export function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval)
        autoRefreshInterval = null
        console.log('🛑 Stopped automatic token refresh')
    }
}
