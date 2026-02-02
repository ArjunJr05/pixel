/**
 * Hybrid Analyzer: Traditional extraction + LLM mapping
 * Outputs in traditional format: "Component - Android, iOS, Web"
 */

import { extractFeatures, compareFeatures } from './analyzer.js';
import { extractDetailedComponents, formatComponentForLLM } from './detailedExtractor.js';

/**
 * Analyzes Figma designs using hybrid approach with traditional output format
 * @param {Object} androidJson - Android Figma JSON
 * @param {Object} iosJson - iOS Figma JSON
 * @param {Object} webJson - Web Figma JSON
 * @param {string} zohoToken - Zoho OAuth token
 * @returns {Promise<Object>} Analysis results in traditional format
 */
export async function analyzeWithHybridApproach(androidJson, iosJson, webJson, zohoToken) {
    console.log('🔄 Starting hybrid analysis (Traditional + LLM)...');

    // Step 1: Extract components using traditional analyzer (for output format)
    console.log('📊 Extracting components with traditional analyzer...');
    const androidFeatures = extractFeatures(androidJson.document);
    const iosFeatures = extractFeatures(iosJson.document);
    const webFeatures = extractFeatures(webJson.document);

    // Step 2: Extract DETAILED components for LLM (with type, hierarchy, children)
    console.log('🔍 Extracting detailed component information for LLM...');
    const androidDetailed = extractDetailedComponents(androidJson.document);
    const iosDetailed = extractDetailedComponents(iosJson.document);
    const webDetailed = extractDetailedComponents(webJson.document);

    console.log(`✅ Extracted detailed: Android(${androidDetailed.length}), iOS(${iosDetailed.length}), Web(${webDetailed.length})`)

    // Check total component count
    const totalComponents = Math.max(androidDetailed.length, iosDetailed.length, webDetailed.length)
    console.log(`📊 Total components: ${totalComponents}`)

    // Step 3: Get traditional comparison (baseline)
    const traditionalResults = compareFeatures(androidFeatures, iosFeatures, webFeatures)

    // Step 4: Send DETAILED components to LLM for intelligent mapping
    let llmMappings = []

    // Check if we need chunking (for large designs)
    const CHUNK_SIZE = 300 // Components per chunk
    const CHUNK_THRESHOLD = 500 // Start chunking at this size

    if (totalComponents > CHUNK_THRESHOLD) {
        console.log(`⚠️ Large design detected (${totalComponents} components)`)
        console.log(`🔄 Using chunked processing (${CHUNK_SIZE} components per chunk)...`)

        // Calculate number of chunks needed
        const numChunks = Math.ceil(totalComponents / CHUNK_SIZE)
        console.log(`📦 Processing ${numChunks} chunks...`)

        // Process each chunk
        for (let i = 0; i < numChunks; i++) {
            const start = i * CHUNK_SIZE
            const end = Math.min(start + CHUNK_SIZE, totalComponents)

            console.log(`🔄 Processing chunk ${i + 1}/${numChunks} (components ${start}-${end})...`)

            // Get chunk for each platform
            const androidChunk = androidDetailed.slice(start, end)
            const iosChunk = iosDetailed.slice(start, end)
            const webChunk = webDetailed.slice(start, end)

            // Send chunk to LLM
            const chunkMappings = await mapWithLLM(androidChunk, iosChunk, webChunk, zohoToken)
            llmMappings.push(...chunkMappings)

            // Add delay between chunks to avoid rate limits
            if (i < numChunks - 1) {
                console.log('⏳ Waiting 5 seconds before next chunk...')
                await delay(5000)
            }
        }

        console.log(`✅ Chunked processing complete! Processed ${llmMappings.length} mappings`)
    } else {
        // Small design - process all at once
        console.log('🤖 Sending detailed components to LLM for intelligent mapping...')
        llmMappings = await mapWithLLM(androidDetailed, iosDetailed, webDetailed, zohoToken)
    }

    // Step 5: Merge traditional and LLM results
    const enhancedMapping = mergeResults(traditionalResults, llmMappings)

    return {
        android: {
            total: androidFeatures.all.size,
            text: androidFeatures.text.size,
            buttons: androidFeatures.buttons.size
        },
        ios: {
            total: iosFeatures.all.size,
            text: iosFeatures.text.size,
            buttons: iosFeatures.buttons.size
        },
        web: {
            total: webFeatures.all.size,
            text: webFeatures.text.size,
            buttons: webFeatures.buttons.size
        },
        consistent: enhancedMapping.consistent,
        inconsistent: enhancedMapping.inconsistent,
        mapping: enhancedMapping.mapping,
        method: 'hybrid'
    };
}

/**
 * Uses LLM to find equivalent components across platforms
 */
async function mapWithLLM(androidComponents, iosComponents, webComponents, zohoToken) {
    const proxyEndpoint = 'http://localhost:3001/api/quickml/llm';
    const orgId = '60064252849';

    // Create RICH component descriptions for LLM (with type, structure, children, hierarchy)
    const androidList = androidComponents.map(formatComponentForLLM).join('\n');
    const iosList = iosComponents.map(formatComponentForLLM).join('\n');
    const webList = webComponents.map(formatComponentForLLM).join('\n');

    const prompt = `Find equivalent UI components across these platforms.
Components serve the SAME PURPOSE even if they have different names or types.
CRITICAL: Map by FUNCTIONALITY, not by name or type!

ANDROID:
${androidList}

IOS:
${iosList}

WEB:
${webList}

UNDERSTANDING COMPONENT TYPES:
- FRAME: Container (e.g., Search Bar with input field inside)
- ICON: Small graphic (e.g., Search Icon, Filter Icon)
- COMPONENT/INSTANCE: Reusable UI component
- TEXT: Text label or button text
- VECTOR: Vector graphic element
- GROUP: Grouped elements

CRITICAL MAPPING RULES:
1. Search functionality:
   - "Search Bar [FRAME]" = "Search Icon [ICON]" = "Search Input [COMPONENT]"
   - Android may have full search bar, iOS/Web may have just icon
   - SAME PURPOSE: All provide search → MAP THEM TOGETHER!

2. Filter functionality:
   - "Filter Button [COMPONENT]" = "Filter Icon [ICON]" = "heroicons-mini/filter [ICON]"
   - Different names, different types, SAME PURPOSE → MAP THEM TOGETHER!

3. Navigation icons:
   - "heroicons-mini/home [ICON]" = "Home Button [COMPONENT]" = "Home [TEXT]"
   - SAME PURPOSE: Navigate to home → MAP THEM TOGETHER!

4. Text equivalents:
   - "Sign In [TEXT]" = "Login [TEXT]" = "Sign In Button [TEXT]"
   - Different wording, SAME PURPOSE → MAP THEM TOGETHER!

REAL EXAMPLES from this design:
- Android: "Search Bar [FRAME]" (full bar with input)
  iOS: "Search Icon [ICON]" (just icon)
  Web: "Search Icon [ICON]" (just icon)
  → MAP TOGETHER: All provide search functionality!

- Android: "heroicons-mini/filter [ICON]"
  iOS: "heroicons-mini/filter [ICON]"
  Web: "Filter [COMPONENT]"
  → MAP TOGETHER: All provide filtering!

Return ONLY a JSON array of equivalent groups:
[
  {
    "android": "Search Bar",
    "ios": "Search Icon",
    "web": "Search Icon"
  },
  {
    "android": "heroicons-mini/filter",
    "ios": "heroicons-mini/filter",
    "web": "Filter"
  },
  {
    "android": "heroicons-mini/home",
    "ios": "heroicons-mini/home",
    "web": "heroicons-mini/home"
  }
]

If a component is missing on a platform, use null.
Focus on FUNCTIONALITY, not name similarity!
Return ONLY the JSON array, nothing else.`;

    const systemPrompt = `You are a UI/UX expert specializing in cross-platform design.
Your task: Map components by FUNCTIONALITY and PURPOSE, NOT by name or type.
Key principle: "Search Bar" and "Search Icon" are EQUIVALENT if both provide search.
A full search bar on Android = a search icon on iOS = SAME FUNCTIONALITY.
Always return valid JSON array only.`;

    console.log(`📝 LLM mapping prompt size: ${prompt.length} characters`);

    const payload = {
        prompt: prompt,
        system_prompt: systemPrompt,
        model: 'crm-di-qwen_text_14b-fp8-it',
        authToken: zohoToken,
        orgId: orgId,
        max_tokens: 2000,
        temperature: 0.5,
        top_p: 0.9,
        top_k: 50
    };

    try {
        const response = await fetch(proxyEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('LLM API error:', errorText);
            return [];
        }

        const data = await response.json();
        console.log('✅ LLM mapping complete!');

        // Parse LLM response
        if (data.choices && data.choices[0] && data.choices[0].message) {
            const content = data.choices[0].message.content;
            try {
                // Try to extract JSON array from response
                const jsonMatch = content.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    console.log(`🎯 LLM found ${parsed.length} equivalent groups`);
                    return parsed;
                }
            } catch (e) {
                console.warn('⚠️ Could not parse LLM response');
            }
        }

        return [];
    } catch (error) {
        console.error('❌ LLM mapping error:', error);
        return [];
    }
}

/**
 * Merges traditional results with LLM mappings
 */
function mergeResults(traditionalResults, llmMappings) {
    const mapping = {
        text: [],
        buttons: []
    };

    let consistent = 0;
    let inconsistent = 0;

    // Create a map of LLM equivalents
    const equivalents = new Map();
    llmMappings.forEach(group => {
        if (group.android) equivalents.set(group.android, group);
        if (group.ios) equivalents.set(group.ios, group);
        if (group.web) equivalents.set(group.web, group);
    });

    // Process traditional results and enhance with LLM mappings
    const processedComponents = new Set();

    traditionalResults.mapping.text.forEach(item => {
        if (processedComponents.has(item.name)) return;

        const llmGroup = equivalents.get(item.name);
        if (llmGroup) {
            // LLM found equivalents - merge them
            const platforms = [];
            if (llmGroup.android) platforms.push('Android');
            if (llmGroup.ios) platforms.push('iOS');
            if (llmGroup.web) platforms.push('Web');

            const platformsStr = platforms.join(', ');
            const icon = platforms.length === 3 ? '✅' : '⚠️';

            mapping.text.push({
                name: item.name,
                platforms: platformsStr,
                icon: icon,
                llmEnhanced: true,
                equivalents: llmGroup
            });

            if (platforms.length === 3) consistent++;
            else inconsistent++;

            // Mark all equivalents as processed
            if (llmGroup.android) processedComponents.add(llmGroup.android);
            if (llmGroup.ios) processedComponents.add(llmGroup.ios);
            if (llmGroup.web) processedComponents.add(llmGroup.web);
        } else {
            // No LLM mapping - use traditional result
            mapping.text.push(item);
            if (item.icon === '✅') consistent++;
            else inconsistent++;
            processedComponents.add(item.name);
        }
    });

    // Same for buttons
    traditionalResults.mapping.buttons.forEach(item => {
        if (processedComponents.has(item.name)) return;

        const llmGroup = equivalents.get(item.name);
        if (llmGroup) {
            const platforms = [];
            if (llmGroup.android) platforms.push('Android');
            if (llmGroup.ios) platforms.push('iOS');
            if (llmGroup.web) platforms.push('Web');

            const platformsStr = platforms.join(', ');
            const icon = platforms.length === 3 ? '✅' : '⚠️';

            mapping.buttons.push({
                name: item.name,
                platforms: platformsStr,
                icon: icon,
                llmEnhanced: true,
                equivalents: llmGroup
            });

            if (platforms.length === 3) consistent++;
            else inconsistent++;

            if (llmGroup.android) processedComponents.add(llmGroup.android);
            if (llmGroup.ios) processedComponents.add(llmGroup.ios);
            if (llmGroup.web) processedComponents.add(llmGroup.web);
        } else {
            mapping.buttons.push(item);
            if (item.icon === '✅') consistent++;
            else inconsistent++;
            processedComponents.add(item.name);
        }
    });

    return {
        consistent,
        inconsistent,
        mapping
    };
}

/**
 * Helper function to delay execution
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
