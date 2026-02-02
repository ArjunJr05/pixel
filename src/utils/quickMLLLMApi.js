// Zoho Catalyst QuickML LLM API Integration
// Uses Qwen 2.5 14B Instruct model for cross-platform UI component mapping

import { getValidToken, updateCredentials, startAutoRefresh } from './tokenManager.js'

const QUICKML_LLM_CONFIG = {
    endpoint: 'https://api.catalyst.zoho.in/quickml/v2/project/28618000000011083/llm/chat',
    orgId: '60064252849',
    model: 'crm-di-qwen_text_14b-fp8-it',
    // Token will be fetched dynamically from tokenManager
    getAuthToken: async () => {
        const token = await getValidToken()
        return `Zoho-oauthtoken ${token}`
    }
}

/**
 * Extracts a lightweight summary of components from Figma JSON
 * This reduces the payload size significantly
 */
function extractComponentSummary(figmaJson) {
    const components = [];

    function traverse(node, depth = 0) {
        if (!node || depth > 10) return; // Prevent infinite recursion

        // Extract relevant info only
        const component = {
            id: node.id,
            name: node.name,
            type: node.type
        };

        // Add text content if available
        if (node.characters) {
            component.text = node.characters;
        }

        // Add component-specific properties
        if (node.type === 'COMPONENT' || node.type === 'INSTANCE' ||
            node.type === 'FRAME' || node.type === 'GROUP' ||
            node.type === 'TEXT' || node.type === 'RECTANGLE') {
            components.push(component);
        }

        // Traverse children
        if (node.children && Array.isArray(node.children)) {
            node.children.forEach(child => traverse(child, depth + 1));
        }
    }

    // Start traversal from document root
    if (figmaJson.document) {
        traverse(figmaJson.document);
    }

    return components;
}

/**
 * Analyzes Figma JSON data using QuickML LLM to identify UI components
 * @param {Object} figmaJson - Figma design JSON data
 * @param {string} platform - Platform name (Android, iOS, Web)
 * @returns {Promise<Object>} Analysis results with component list
 */
export async function analyzeFigmaComponents(figmaJson, platform) {
    // Extract only component summary to reduce size
    const componentSummary = extractComponentSummary(figmaJson);

    console.log(`📊 Extracted ${componentSummary.length} components from ${platform} design`);
    console.log(`📏 Summary size: ${JSON.stringify(componentSummary).length} characters`);

    const prompt = `Analyze this Figma design component list for ${platform} platform and extract all UI components.

Component List:
${JSON.stringify(componentSummary, null, 2)}

Please identify and list all interactive UI components with the following details:
1. Component type (button, search_bar, search_icon, input_field, text_field, dropdown, checkbox, icon, etc.)
2. Component name/label
3. Component purpose/function
4. Text content (if any)
5. Component ID from Figma

Return the response in this exact JSON format:
{
  "platform": "${platform}",
  "components": [
    {
      "id": "figma_node_id",
      "type": "component_type",
      "name": "component_name",
      "purpose": "what_it_does",
      "text": "visible_text",
      "properties": {}
    }
  ]
}`

    const systemPrompt = `You are a UI/UX expert specializing in cross-platform design analysis. 
You understand that the same functionality can be implemented differently across platforms:
- Android often uses search bars, material design buttons
- iOS often uses search icons, native iOS controls
- Web uses standard HTML elements

Be precise and extract all interactive components from the Figma JSON structure.
Always return valid JSON format.`

    try {
        console.log(`🔍 Analyzing ${platform} components...`)
        console.log(`📝 Prompt length: ${prompt.length} characters`)
        const response = await callQuickMLLLM(prompt, systemPrompt, 2000)
        console.log(`✅ ${platform} analysis complete`)
        return parseComponentAnalysis(response, platform)
    } catch (error) {
        console.error(`❌ Error analyzing ${platform} components:`, error)
        console.error(`Error details:`, {
            message: error.message,
            stack: error.stack
        })
        throw error
    }
}

/**
 * Maps components across three platforms using LLM intelligence
 * @param {Object} androidComponents - Android component analysis
 * @param {Object} iosComponents - iOS component analysis
 * @param {Object} webComponents - Web component analysis
 * @returns {Promise<Object>} Mapped components showing equivalents
 */
export async function mapComponentsAcrossPlatforms(androidComponents, iosComponents, webComponents) {
    // Extract only the components arrays to reduce payload size
    const androidList = androidComponents.components || [];
    const iosList = iosComponents.components || [];
    const webList = webComponents.components || [];

    console.log(`🔗 Mapping components: Android(${androidList.length}), iOS(${iosList.length}), Web(${webList.length})`);

    const prompt = `You are analyzing UI designs across three platforms: Android, iOS, and Web.

ANDROID COMPONENTS:
${JSON.stringify(androidList, null, 2)}

IOS COMPONENTS:
${JSON.stringify(iosList, null, 2)}

WEB COMPONENTS:
${JSON.stringify(webList, null, 2)}

Task: Map equivalent components across all three platforms. Components serve the SAME PURPOSE even if they look different.

Examples of equivalent components:
- Android "Search Bar" = iOS "Search Icon" = Web "Search Input"
- Android "Book Ticket Button" = iOS "Book Ticket Button" = Web "Submit Button"
- Android "Date Picker" = iOS "Date Selector" = Web "Date Input"

Return the mapping in this exact JSON format:
{
  "mappings": [
    {
      "purpose": "search_functionality",
      "android": {
        "id": "component_id",
        "type": "search_bar",
        "name": "Search flights...",
        "implementation": "SearchBar component"
      },
      "ios": {
        "id": "component_id",
        "type": "search_icon",
        "name": "Search",
        "implementation": "Magnifying glass icon"
      },
      "web": {
        "id": "component_id",
        "type": "search_input",
        "name": "Search",
        "implementation": "Input field with search icon"
      },
      "consistency": "equivalent",
      "notes": "Same search functionality, different UI patterns"
    }
  ],
  "summary": {
    "total_mappings": 0,
    "consistent_components": 0,
    "missing_on_platforms": [],
    "inconsistencies": []
  }
}`

    const systemPrompt = `You are an expert in cross-platform UI/UX design patterns.
You understand platform-specific design guidelines:
- Material Design for Android
- Human Interface Guidelines for iOS
- Web accessibility standards

Your task is to identify functionally equivalent components even when they have different visual implementations.
Focus on PURPOSE and FUNCTIONALITY, not just appearance.
Always return valid JSON.`

    try {
        console.log(`📝 Mapping prompt length: ${prompt.length} characters`);
        const response = await callQuickMLLLM(prompt, systemPrompt, 3000)
        return parseComponentMapping(response)
    } catch (error) {
        console.error('Error mapping components:', error)
        throw error
    }
}

/**
 * Core function to call QuickML LLM API
 * @param {string} prompt - Main prompt
 * @param {string} systemPrompt - System instructions
 * @param {number} maxTokens - Maximum response tokens
 * @returns {Promise<string>} LLM response text
 */
async function callQuickMLLLM(prompt, systemPrompt, maxTokens = 1000) {
    const proxyEndpoint = 'http://localhost:3001/api/quickml/llm';

    // Get auth token from localStorage
    const authToken = localStorage.getItem('zoho_oauth_token') || '';
    const orgId = '60064252849';

    if (!authToken) {
        throw new Error('Zoho OAuth token not configured. Please set your token in the configuration section.');
    }

    const payload = {
        prompt: prompt,
        system_prompt: systemPrompt,
        model: QUICKML_LLM_CONFIG.model,
        authToken: authToken,
        orgId: orgId,
        max_tokens: maxTokens
    };

    console.log('🚀 Calling QuickML LLM API via proxy...');
    console.log('📍 Proxy endpoint:', proxyEndpoint);
    console.log('🔧 Model:', QUICKML_LLM_CONFIG.model);
    console.log('📊 Payload:', {
        model: payload.model,
        prompt_length: payload.prompt.length,
        system_prompt_length: payload.system_prompt.length,
        max_tokens: payload.max_tokens
    });

    try {
        const response = await fetch(proxyEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        console.log('📡 Response status:', response.status, response.statusText);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error || errorData.details || `API error: ${response.status}`;
            console.error('❌ API Error Response:', errorData);
            throw new Error(errorMsg);
        }

        const data = await response.json();
        console.log('✅ API Response received');
        console.log('📦 Response keys:', Object.keys(data));

        // Extract response text
        if (data.response) {
            console.log('✓ Found response field, length:', data.response.length);
            return data.response;
        } else if (data.choices && data.choices[0]?.message?.content) {
            console.log('✓ Found choices field');
            return data.choices[0].message.content;
        } else {
            console.error('❌ Unexpected response format:', data);
            throw new Error('Unexpected response format from QuickML LLM');
        }
    } catch (error) {
        console.error('❌ QuickML LLM API Error:', error);
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);

        // Check for network errors
        if (error.message.includes('Failed to fetch') || error.message.includes('fetch')) {
            throw new Error('Cannot connect to proxy server. Make sure the proxy server is running on http://localhost:3001');
        }

        throw error;
    }
}

/**
 * Parses component analysis response from LLM
 */
function parseComponentAnalysis(llmResponse, platform) {
    try {
        // Try to extract JSON from the response
        const jsonMatch = llmResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            return {
                platform: platform,
                components: parsed.components || [],
                rawResponse: llmResponse
            }
        }

        // Fallback: manual parsing if JSON not found
        return {
            platform: platform,
            components: [],
            rawResponse: llmResponse,
            error: 'Could not parse JSON from LLM response'
        }
    } catch (error) {
        console.error('Error parsing component analysis:', error)
        return {
            platform: platform,
            components: [],
            rawResponse: llmResponse,
            error: error.message
        }
    }
}

/**
 * Parses component mapping response from LLM
 */
function parseComponentMapping(llmResponse) {
    try {
        // Try to extract JSON from the response
        const jsonMatch = llmResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            return {
                mappings: parsed.mappings || [],
                summary: parsed.summary || {},
                rawResponse: llmResponse,
                success: true
            }
        }

        // Fallback
        return {
            mappings: [],
            summary: {},
            rawResponse: llmResponse,
            success: false,
            error: 'Could not parse JSON from LLM response'
        }
    } catch (error) {
        console.error('Error parsing component mapping:', error)
        return {
            mappings: [],
            summary: {},
            rawResponse: llmResponse,
            success: false,
            error: error.message
        }
    }
}

/**
 * Fetches Figma file JSON data
 * @param {string} fileKey - Figma file key from URL
 * @param {string} accessToken - Figma personal access token
 * @returns {Promise<Object>} Figma file data
 */
/**
 * Fetches Figma file JSON data with rate limit handling
 * @param {string} fileKey - Figma file key
 * @param {string} accessToken - Figma personal access token
 * @param {number} retryCount - Current retry attempt (internal use)
 * @returns {Promise<Object>} Figma file data
 */
export async function fetchFigmaJSON(fileKey, accessToken, retryCount = 0) {
    const url = `https://api.figma.com/v1/files/${fileKey}`
    const maxRetries = 3

    console.log('🎨 Fetching Figma file...')
    console.log('📍 File key:', fileKey)
    console.log('🔑 Token length:', accessToken.trim().length)
    if (retryCount > 0) {
        console.log('🔄 Retry attempt:', retryCount, '/', maxRetries)
    }

    try {
        const response = await fetch(url, {
            headers: {
                'X-Figma-Token': accessToken.trim()
            }
        })

        console.log('📡 Figma API status:', response.status, response.statusText)

        // Handle rate limiting (429)
        if (response.status === 429) {
            const errorText = await response.text()
            console.warn('⚠️ Rate limit exceeded!')

            if (retryCount < maxRetries) {
                // Exponential backoff: 2s, 4s, 8s
                const waitTime = Math.pow(2, retryCount + 1) * 1000
                console.log(`⏳ Waiting ${waitTime / 1000} seconds before retry...`)

                await new Promise(resolve => setTimeout(resolve, waitTime))
                return fetchFigmaJSON(fileKey, accessToken, retryCount + 1)
            } else {
                console.error('❌ Max retries reached for rate limit')
                throw new Error(`Figma API rate limit exceeded. Please wait a few minutes and try again. Error: ${errorText}`)
            }
        }

        if (!response.ok) {
            const errorText = await response.text()
            console.error('❌ Figma API Error:', errorText)
            throw new Error(`Figma API error (${response.status}): ${errorText}`)
        }

        const data = await response.json()
        console.log('✅ Figma data received')
        console.log('📦 Document name:', data.name)
        return data
    } catch (error) {
        console.error('❌ Error fetching Figma JSON:', error)
        console.error('Error details:', {
            message: error.message,
            type: error.constructor.name
        })
        throw error
    }
}

/**
 * Extracts file key from Figma URL
 * @param {string} figmaUrl - Full Figma URL
 * @returns {string} File key
 */
export function extractFigmaFileKey(figmaUrl) {
    // Figma URL format: https://www.figma.com/file/{fileKey}/{fileName}
    // or: https://www.figma.com/design/{fileKey}/{fileName}
    const match = figmaUrl.match(/figma\.com\/(file|design)\/([a-zA-Z0-9]+)/)
    if (match && match[2]) {
        return match[2]
    }
    throw new Error('Invalid Figma URL format')
}

/**
 * Complete workflow: Fetch Figma data and analyze with LLM
 * @param {string} androidUrl - Android Figma URL
 * @param {string} iosUrl - iOS Figma URL
 * @param {string} webUrl - Web Figma URL
 * @param {string} accessToken - Figma personal access token
 * @returns {Promise<Object>} Complete analysis and mapping
 */
export async function analyzeAndMapPlatforms(androidUrl, iosUrl, webUrl, accessToken) {
    try {
        // Step 1: Extract file keys
        const androidKey = extractFigmaFileKey(androidUrl)
        const iosKey = extractFigmaFileKey(iosUrl)
        const webKey = extractFigmaFileKey(webUrl)

        console.log('Fetching Figma designs...')

        // Step 2: Fetch Figma JSON data SEQUENTIALLY with delays to avoid rate limiting
        console.log('⏳ Fetching Android design...')
        const androidData = await fetchFigmaJSON(androidKey, accessToken)

        console.log('⏳ Waiting 3 seconds before next request...')
        await new Promise(resolve => setTimeout(resolve, 10000))

        console.log('⏳ Fetching iOS design...')
        const iosData = await fetchFigmaJSON(iosKey, accessToken)

        console.log('⏳ Waiting 3 seconds before next request...')
        await new Promise(resolve => setTimeout(resolve, 10000))

        console.log('⏳ Fetching Web design...')
        const webData = await fetchFigmaJSON(webKey, accessToken)

        console.log('Analyzing components with QuickML LLM...')

        // Step 3: Analyze each platform with LLM
        const [androidAnalysis, iosAnalysis, webAnalysis] = await Promise.all([
            analyzeFigmaComponents(androidData, 'Android'),
            analyzeFigmaComponents(iosData, 'iOS'),
            analyzeFigmaComponents(webData, 'Web')
        ])

        console.log('Mapping components across platforms...')

        // Step 4: Map components across platforms
        const mapping = await mapComponentsAcrossPlatforms(
            androidAnalysis,
            iosAnalysis,
            webAnalysis
        )

        return {
            success: true,
            platforms: {
                android: androidAnalysis,
                ios: iosAnalysis,
                web: webAnalysis
            },
            mapping: mapping,
            timestamp: new Date().toISOString()
        }
    } catch (error) {
        console.error('Error in complete analysis workflow:', error)
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }
    }
}

/**
 * Configuration management
 */
export function setQuickMLLLMConfig(config) {
    if (config.endpoint) QUICKML_LLM_CONFIG.endpoint = config.endpoint
    if (config.orgId) QUICKML_LLM_CONFIG.orgId = config.orgId
    if (config.authToken) QUICKML_LLM_CONFIG.authToken = config.authToken
    if (config.model) QUICKML_LLM_CONFIG.model = config.model
}

export function getQuickMLLLMConfig() {
    return { ...QUICKML_LLM_CONFIG }
}
