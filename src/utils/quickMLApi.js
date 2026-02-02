// Zoho Catalyst QuickML Vision API Integration
// Analyzes UI components using VL-Qwen2.5-7B Vision Language Model

const QUICKML_CONFIG = {
    // Use proxy server to avoid CORS issues
    proxyEndpoint: 'http://localhost:3001/api/quickml/analyze',
    orgId: '60064252849',
    // Auth token should be provided by user, not hardcoded
    authToken: null
}

/**
 * Analyzes a Figma design using QuickML Vision AI
 * @param {string} base64Image - Base64 encoded image
 * @param {string} prompt - Custom prompt for analysis
 * @returns {Promise<Object>} Analysis results
 */
export async function analyzeDesignWithAI(base64Image, prompt = null) {
    const defaultPrompt = `Analyze this UI design and identify all interactive components. 
For each component, provide:
1. Component type (button, search bar, input field, icon, etc.)
2. Component purpose/function
3. Visual characteristics
4. Text content (if any)
5. Position/location

Focus on identifying functionally similar components even if they look different.`

    const payload = {
        prompt: prompt || defaultPrompt,
        model: 'VL-Qwen2.5-7B',
        images: [base64Image],
        system_prompt: 'You are a UI/UX expert analyzing mobile and web interfaces. Be precise and structured in your analysis.',
        top_k: 50,
        top_p: 0.9,
        temperature: 0.7,
        max_tokens: 2000
    }

    try {
        // Get auth token from config or localStorage
        const authToken = QUICKML_CONFIG.authToken || localStorage.getItem('quickml_token')

        if (!authToken) {
            throw new Error('QuickML auth token not configured. Please set your Zoho OAuth token.')
        }

        // Use proxy server to avoid CORS issues
        const response = await fetch(QUICKML_CONFIG.proxyEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: payload.prompt,
                images: payload.images,
                authToken: authToken,
                orgId: QUICKML_CONFIG.orgId
            })
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            const errorMsg = errorData.error || errorData.message || `API error: ${response.status}`
            throw new Error(errorMsg)
        }

        const data = await response.json()
        return parseQuickMLResponse(data)
    } catch (error) {
        console.error('QuickML API Error:', error)

        // Provide helpful error messages
        if (error.message.includes('Failed to fetch')) {
            throw new Error('Cannot connect to proxy server. Make sure the proxy server is running on http://localhost:3001')
        }

        throw error
    }
}

/**
 * Parses QuickML response and extracts component information
 */
function parseQuickMLResponse(response) {
    const result = {
        analysis: '',
        components: [],
        metrics: {},
        rawResponse: response
    }

    if (response.response) {
        result.analysis = response.response
        result.components = extractComponentsFromAnalysis(response.response)
    }

    if (response.metrics) {
        result.metrics = {
            processingTime: response.metrics.processing_time,
            totalTime: response.metrics.total_time_taken,
            inputTokens: response.metrics.input_text_token_length,
            outputTokens: response.metrics.output_text_token_length
        }
    }

    return result
}

/**
 * Extracts structured component data from AI analysis text
 */
function extractComponentsFromAnalysis(analysisText) {
    const components = []

    // Parse the AI response to extract component information
    // This is a simple parser - can be enhanced based on actual AI response format
    const lines = analysisText.split('\n')
    let currentComponent = null

    for (const line of lines) {
        const trimmed = line.trim()

        // Detect component mentions
        if (trimmed.match(/button|search|input|icon|field|text|image/i)) {
            if (currentComponent) {
                components.push(currentComponent)
            }
            currentComponent = {
                type: extractComponentType(trimmed),
                description: trimmed,
                purpose: extractPurpose(trimmed),
                text: extractText(trimmed)
            }
        } else if (currentComponent && trimmed) {
            currentComponent.description += ' ' + trimmed
        }
    }

    if (currentComponent) {
        components.push(currentComponent)
    }

    return components
}

function extractComponentType(text) {
    const types = ['button', 'search', 'input', 'icon', 'field', 'text', 'image', 'dropdown', 'checkbox']
    for (const type of types) {
        if (text.toLowerCase().includes(type)) {
            return type
        }
    }
    return 'unknown'
}

function extractPurpose(text) {
    // Extract purpose from text (simplified)
    if (text.toLowerCase().includes('search')) return 'search'
    if (text.toLowerCase().includes('submit') || text.toLowerCase().includes('book')) return 'submit'
    if (text.toLowerCase().includes('date')) return 'date-selection'
    if (text.toLowerCase().includes('name')) return 'name-input'
    return 'general'
}

function extractText(text) {
    // Extract quoted text or text in parentheses
    const quoted = text.match(/"([^"]+)"/)?.[1]
    const parentheses = text.match(/\(([^)]+)\)/)?.[1]
    return quoted || parentheses || ''
}

/**
 * Compares components across platforms using AI
 */
export async function compareComponentsAcrossPlat forms(androidImage, iosImage, webImage) {
    const prompt = `Compare these three UI designs (Android, iOS, Web) and identify:
1. Components that serve the SAME function across all platforms (even if they look different)
2. Components that are missing on some platforms
3. Visual differences in how the same functionality is implemented

For example:
- A search bar on Android might be a search icon on iOS
- A button might have different text but same function
- Input fields might be styled differently

Provide a structured mapping of equivalent components.`

    try {
        // Analyze all three platforms
        const [androidAnalysis, iosAnalysis, webAnalysis] = await Promise.all([
            analyzeDesignWithAI(androidImage, 'Identify all UI components in this Android design'),
            analyzeDesignWithAI(iosImage, 'Identify all UI components in this iOS design'),
            analyzeDesignWithAI(webImage, 'Identify all UI components in this Web design')
        ])

        // Perform cross-platform comparison
        const comparisonResult = await analyzeDesignWithAI(
            androidImage, // Use one as reference
            prompt
        )

        return {
            android: androidAnalysis,
            ios: iosAnalysis,
            web: webAnalysis,
            comparison: comparisonResult,
            mapping: generateComponentMapping(androidAnalysis, iosAnalysis, webAnalysis)
        }
    } catch (error) {
        console.error('Cross-platform comparison error:', error)
        throw error
    }
}

/**
 * Generates component mapping based on AI analysis
 */
function generateComponentMapping(androidAnalysis, iosAnalysis, webAnalysis) {
    const mapping = []

    // Group components by purpose
    const androidByPurpose = groupByPurpose(androidAnalysis.components)
    const iosByPurpose = groupByPurpose(iosAnalysis.components)
    const webByPurpose = groupByPurpose(webAnalysis.components)

    // Find common purposes
    const allPurposes = new Set([
        ...Object.keys(androidByPurpose),
        ...Object.keys(iosByPurpose),
        ...Object.keys(webByPurpose)
    ])

    for (const purpose of allPurposes) {
        const androidComp = androidByPurpose[purpose]?.[0]
        const iosComp = iosByPurpose[purpose]?.[0]
        const webComp = webByPurpose[purpose]?.[0]

        const platforms = []
        if (androidComp) platforms.push('Android')
        if (iosComp) platforms.push('iOS')
        if (webComp) platforms.push('Web')

        mapping.push({
            purpose,
            platforms: platforms.join(', '),
            android: androidComp?.type || 'missing',
            ios: iosComp?.type || 'missing',
            web: webComp?.type || 'missing',
            consistent: platforms.length === 3,
            details: {
                android: androidComp?.description || '',
                ios: iosComp?.description || '',
                web: webComp?.description || ''
            }
        })
    }

    return mapping
}

function groupByPurpose(components) {
    return components.reduce((acc, comp) => {
        const purpose = comp.purpose || 'general'
        if (!acc[purpose]) acc[purpose] = []
        acc[purpose].push(comp)
        return acc
    }, {})
}

/**
 * Fetches Figma design as image for AI analysis
 */
export async function getFigmaDesignImage(fileId, nodeId, accessToken) {
    const url = `https://api.figma.com/v1/images/${fileId}?ids=${nodeId}&format=png&scale=2`

    try {
        const response = await fetch(url, {
            headers: {
                'X-Figma-Token': accessToken.trim()
            }
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch Figma image: ${response.status}`)
        }

        const data = await response.json()

        if (data.images && data.images[nodeId]) {
            const imageUrl = data.images[nodeId]

            // Fetch the actual image and convert to base64
            const imageResponse = await fetch(imageUrl)
            const blob = await imageResponse.blob()
            return await blobToBase64(blob)
        }

        throw new Error('No image URL in response')
    } catch (error) {
        console.error('Error fetching Figma image:', error)
        throw error
    }
}

/**
 * Converts blob to base64
 */
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[1] // Remove data:image/png;base64, prefix
            resolve(base64)
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })
}

/**
 * Configuration management
 */
export function setQuickMLConfig(config) {
    if (config.endpoint) QUICKML_CONFIG.endpoint = config.endpoint
    if (config.orgId) QUICKML_CONFIG.orgId = config.orgId
    if (config.authToken) QUICKML_CONFIG.authToken = config.authToken
}

export function getQuickMLConfig() {
    return { ...QUICKML_CONFIG }
}
