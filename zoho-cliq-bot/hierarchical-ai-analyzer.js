import axios from 'axios';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

dotenv.config();

const CATALYST_API_URL = 'https://api.catalyst.zoho.in/quickml/v2/project/28618000000011083/llm/chat';
const CATALYST_ORG = '60064252849';

/**
 * Step 1: Send Android structure to AI for extraction
 */
async function extractCardsWithAI(compactRepresentation) {
    const { platform, cards } = compactRepresentation;

    if (!cards || cards.length === 0) {
        console.log(`   ⏭️ Skipping ${platform} (0 features)`);
        return [];
    }

    console.log(`🤖 Sending ${platform} structure to AI (${cards.length} cards)...`);

    // Add a small delay to avoid hitting rate limits for parallel calls
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));

    const prompt = `You are a UI Semantic Feature Extractor.
Platform: ${platform} | Page: "${compactRepresentation.pageName || 'Unknown Page'}"

Objective: Convert UI summaries into semantic intents.
A FEATURE is a user capability, not an element.

Rules:
- Ignore styling, layout, sizes, and counts.
- Infer intent from text/icons.
- One feature = one intent.
- Types: profile_section, list_item, action_item, navigation_bar, status_bar, unknown
- Return JSON array of objects.
- Use SCREAMING_SNAKE_CASE (e.g., SEARCH_BAR).

Data:
${cards.slice(0, 30).map((card, i) => {
        const icons = card.inventory?.icons?.map(ic => ic.name).join(',') || 'none';
        return `${i + 1}.${card.name} [T:${card.inventory?.texts || 0},I:${icons},B:${card.inventory?.buttons || 0}]`;
    }).join('\n')}

Output JSON format:
[{ "name": "...", "intent": "...", "type": "...", "confidence_score": 0.95 }]`;

    const response = await callCatalystAI(prompt, 1000);

    try {
        // Extract JSON from response
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        // Fallback: return original cards with mock semantic info
        return cards.map(c => ({
            name: c.name,
            intent: "UNKNOWN",
            type: "unknown",
            confidence_score: 0.0,
            inventory: c.inventory,
            detailedString: c.detailedString
        }));
    } catch (err) {
        console.error('⚠️ Failed to parse AI response, using original data');
        return cards.map(c => ({
            name: c.name,
            intent: "UNKNOWN",
            type: "unknown",
            confidence_score: 0.0,
            inventory: c.inventory,
            detailedString: c.detailedString
        }));
    }
}

/**
 * Step 2: Compare extracted cards across all platforms
 */
async function compareCardsAcrossPlatforms(androidCards, iosCards, webCards) {
    console.log('🤖 Comparing cards across platforms with AI...');

    const prompt = `You are a UI Semantic Intent Analyzer.

You are analyzing ONE UI PAGE at a time across Android, iOS, and Web.
A FEATURE is a user-visible capability or action, not a UI element.

Your job:
1. Match equivalent features across platforms by their FEATURE INTENTS.
2. Identify missing or platform-specific features.

STRICT RULES:
- Ignore visual styling, layout, sizes, colors, coordinates, and counts.
- Do NOT rely on frame or layer names to infer meaning.
- Use only semantic meaning from the descriptions.
- Treat this page independently. Do NOT infer from other pages.

ANDROID (${androidCards.length} features):
${androidCards.map((c, i) => `${i + 1}. ${c.name} [Intent: ${c.intent}, Type: ${c.type}]`).join('\n')}

IOS (${iosCards.length} features):
${iosCards.map((c, i) => `${i + 1}. ${c.name} [Intent: ${c.intent}, Type: ${c.type}]`).join('\n')}

WEB (${webCards.length} features):
${webCards.map((c, i) => `${i + 1}. ${c.name} [Intent: ${c.intent}, Type: ${c.type}]`).join('\n')}

Output as JSON:
{
  "matches": [
    {
      "intent": "The most descriptive Intent (SCREAMING_SNAKE_CASE)",
      "original_names": {
        "Android": "Original name from Android list",
        "iOS": "Original name from iOS list",
        "Web": "Original name from Web list"
      },
      "platforms": ["Android", "iOS", "Web"],
      "status": "perfect" | "structural_mismatch" | "missing" | "platform_specific",
      "details": "Explanation of functional alignment",
      "confidence_score": 0.0 - 1.0,
      "missing_fields": ["intent_mismatch", "type_mismatch"]
    }
  ],
  "summary": {
    "totalUnique": N,
    "perfectMatches": N,
    "mismatches": N,
    "missing": N,
    "platformSpecific": N
  }
}`;

    const response = await callCatalystAI(prompt, 3000);

    try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    } catch (err) {
        console.error('⚠️ Failed to parse comparison, using fallback');
    }

    // Fallback: simple name-based matching
    return fallbackComparison(androidCards, iosCards, webCards);
}

/**
 * Fallback comparison if AI fails
 */
function fallbackComparison(androidCards, iosCards, webCards) {
    const allNames = new Set([
        ...androidCards.map(c => c.name),
        ...iosCards.map(c => c.name),
        ...webCards.map(c => c.name)
    ]);

    const matches = [];
    let perfectMatches = 0;
    let mismatches = 0;
    let missing = 0;

    allNames.forEach(name => {
        const android = androidCards.find(c => c.name === name);
        const ios = iosCards.find(c => c.name === name);
        const web = webCards.find(c => c.name === name);

        const platforms = [];
        if (android) platforms.push('Android');
        if (ios) platforms.push('iOS');
        if (web) platforms.push('Web');

        let status = 'missing';
        if (platforms.length === 3) {
            // Check if inventory strings match exactly (simple check)
            const inventories = [android.detailedString, ios.detailedString, web.detailedString];
            status = (new Set(inventories).size === 1) ? 'perfect' : 'structural_mismatch';

            if (status === 'perfect') perfectMatches++;
            else mismatches++;
        } else {
            missing++;
        }

        matches.push({
            cardName: name,
            platforms,
            status,
            details: status === 'missing'
                ? `Missing from: ${['Android', 'iOS', 'Web'].filter(p => !platforms.includes(p)).join(', ')}`
                : status === 'structural_mismatch'
                    ? 'Structure differs across platforms'
                    : 'Perfect match'
        });
    });

    return {
        matches,
        summary: {
            totalUnique: allNames.size,
            perfectMatches,
            mismatches,
            missing
        }
    };
}

/**
 * Main orchestrator: Page-scoped Multi-step AI analysis
 */
export async function analyzeWithHierarchicalAI(androidPages, iosPages, webPages) {
    console.log('\n🚀 Starting Page-Scoped Hierarchical AI analysis...\n');

    const finalResults = {
        android: { total: 0 },
        ios: { total: 0 },
        web: { total: 0 },
        consistent: 0,
        inconsistent: 0,
        mapping: {
            text: [],
            buttons: [],
            recipes: []
        }
    };

    // Find all unique page names
    const allPageNames = new Set([
        ...androidPages.map(p => p.pageName),
        ...iosPages.map(p => p.pageName),
        ...webPages.map(p => p.pageName)
    ]);

    for (const pageName of allPageNames) {
        console.log(`\n📄 Analyzing Page: ${pageName}`);

        const androidPage = androidPages.find(p => p.pageName === pageName);
        const iosPage = iosPages.find(p => p.pageName === pageName);
        const webPage = webPages.find(p => p.pageName === pageName);

        if (androidPage) finalResults.android.total += androidPage.cards.length;
        if (iosPage) finalResults.ios.total += iosPage.cards.length;
        if (webPage) finalResults.web.total += webPage.cards.length;

        // Skip if no content on any platform for this page
        if (!androidPage && !iosPage && !webPage) continue;

        try {
            // Create compact representations for this page
            const createCompact = (page, platform) => ({
                platform,
                pageName: page?.pageName || pageName,
                totalCards: page?.cards?.length || 0,
                cards: page?.cards?.map(card => ({
                    name: card.name,
                    inventory: card.inventory,
                    detailedString: card.detailedString
                })) || []
            });

            const androidCompact = createCompact(androidPage, 'Android');
            const iosCompact = createCompact(iosPage, 'iOS');
            const webCompact = createCompact(webPage, 'Web');

            // Step 1: Extract semantic intents for this page
            let [androidExtracted, iosExtracted, webExtracted] = await Promise.all([
                extractCardsWithAI(androidCompact),
                extractCardsWithAI(iosCompact),
                extractCardsWithAI(webCompact)
            ]);

            // Robust Fallback: If AI returns empty for a platform that HAS cards, use name-based semantic extraction
            const createFallbackExtraction = (compact) => (compact.cards || []).map(c => ({
                name: c.name,
                intent: c.name.toUpperCase().replace(/\s+/g, '_'),
                type: 'unknown',
                confidence_score: 0.5
            }));

            if (androidExtracted.length === 0 && androidCompact.cards.length > 0) androidExtracted = createFallbackExtraction(androidCompact);
            if (iosExtracted.length === 0 && iosCompact.cards.length > 0) iosExtracted = createFallbackExtraction(iosCompact);
            if (webExtracted.length === 0 && webCompact.cards.length > 0) webExtracted = createFallbackExtraction(webCompact);

            console.log(`   Page Results: Android=${androidExtracted.length}, iOS=${iosExtracted.length}, Web=${webExtracted.length}`);

            // Skip comparison if still no features found
            if (androidExtracted.length === 0 && iosExtracted.length === 0 && webExtracted.length === 0) continue;

            // Add page context to extracted cards
            androidExtracted.forEach(c => c.pageName = pageName);
            iosExtracted.forEach(c => c.pageName = pageName);
            webExtracted.forEach(c => c.pageName = pageName);

            // Step 2: Compare across platforms for this page
            const comparison = await compareCardsAcrossPlatforms(
                androidExtracted,
                iosExtracted,
                webExtracted
            );

            console.log(`   Comparison status: ${comparison.summary?.perfectMatches || 0} perfect, ${comparison.summary?.mismatches || 0} mismatches`);

            // Convert and Merge
            const pageResults = convertToStandardFormat(comparison, androidCompact, iosCompact, webCompact);

            // Add page metadata to names
            pageResults.mapping.text.forEach(item => {
                item.name = `[${pageName}] ${item.name}`;
            });

            finalResults.consistent += pageResults.consistent;
            finalResults.inconsistent += pageResults.inconsistent;
            finalResults.mapping.text.push(...pageResults.mapping.text);

        } catch (error) {
            console.error(`❌ Analysis failed for page ${pageName}:`, error.message);
        }
    }

    return finalResults;
}

/**
 * Convert AI comparison result to standard format
 */
function convertToStandardFormat(aiComparison, androidCompact, iosCompact, webCompact) {
    const { matches, summary } = aiComparison;

    // Helper to find original card details with flexible matching
    const findOriginalCard = (name) => {
        const normalize = (s) => (s || '').toLowerCase().trim();
        const searchName = normalize(name);

        const allOriginalCards = [
            ...(androidCompact.cards || []),
            ...(iosCompact.cards || []),
            ...(webCompact.cards || [])
        ];

        return allOriginalCards.find(c => normalize(c.name) === searchName);
    };

    return {
        android: { total: 0 }, // Will be filled by caller
        ios: { total: 0 },
        web: { total: 0 },
        consistent: summary.perfectMatches || 0,
        inconsistent: (summary.mismatches || 0) + (summary.missing || 0) + (summary.platformSpecific || 0),
        mapping: {
            text: matches.map(m => {
                // Try to find the original design data using the original names provided by the AI
                const androidOriginal = m.original_names?.Android ? findOriginalCard(m.original_names.Android) : null;
                const iosOriginal = m.original_names?.iOS ? findOriginalCard(m.original_names.iOS) : null;
                const webOriginal = m.original_names?.Web ? findOriginalCard(m.original_names.Web) : null;

                const original = androidOriginal || iosOriginal || webOriginal;
                const scoreInfo = m.confidence_score !== undefined ? ` [Confidence: ${m.confidence_score}]` : '';
                const missingInfo = m.missing_fields?.length > 0 ? `\n   Missing: ${m.missing_fields.join(', ')}` : '';

                let icon = '⚠️';
                if (m.status === 'perfect') icon = '✅';
                else if (m.status === 'platform_specific') icon = '📱';
                else if (m.status === 'missing') icon = '❌';

                return {
                    name: m.intent || m.cardName || 'UNKNOWN_FEATURE',
                    platforms: Array.isArray(m.platforms) ? m.platforms.join(', ') : (m.platforms || ''),
                    countInfo: `${m.details}${scoreInfo}`,
                    icon: icon,
                    details: m.status === 'perfect'
                        ? `✅ Functional Intent Matches${scoreInfo}`
                        : `${m.details}${missingInfo}${scoreInfo}`,
                    detailedString: original ? original.detailedString : ''
                };
            }),
            buttons: [],
            recipes: []
        }
    };
}

/**
 * Call Catalyst AI with token refresh
 */
async function callCatalystAI(prompt, maxTokens = 1000) {
    console.log(`📡 Calling Catalyst AI (Prompt Length: ${prompt.length})...`);

    const callAI = async (token) => {
        try {
            return await axios.post(
                CATALYST_API_URL,
                {
                    prompt,
                    model: 'crm-di-qwen_text_14b-fp8-it',
                    system_prompt: 'You are a UI Intent Analyzer. Map structural UI summaries to functional intents. JSON output only.',
                    temperature: 0.1,
                    max_tokens: maxTokens
                },
                {
                    headers: {
                        'CATALYST-ORG': CATALYST_ORG,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
        } catch (error) {
            if (error.response?.status === 400) {
                const details = error.response.data;
                console.error('❌ Catalyst AI 400 Error Details:', JSON.stringify(details, null, 2));

                // If the prompt is too long, we need a hard fallback or a truncated attempt
                if (details.code === 'MORE_THAN_MAX_LENGTH' || details.code === 'LESS_THAN_MIN_OCCURANCE') {
                    console.log('⚠️ Catalyst rejected payload structure. Attempting minimal fallback...');
                }
            }
            throw error;
        }
    };

    let token = process.env.CATALYST_ACCESS_TOKEN;

    try {
        const response = await callAI(token);
        return response.data.response;
    } catch (err) {
        if (err.response?.status === 401) {
            console.log('🔄 Token expired, refreshing...');
            execSync('node refresh-token.js');
            dotenv.config({ override: true });
            token = process.env.CATALYST_ACCESS_TOKEN;
            const response = await callAI(token);
            return response.data.response;
        }
        throw err;
    }
}
