import axios from 'axios';
import fs from 'fs';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

dotenv.config();

const CATALYST_API_URL = 'https://api.catalyst.zoho.in/quickml/v2/project/28618000000011083/llm/chat';
const CATALYST_ORG = '60064252849';

/**
 * Batch AI structural comparison
 * Compares multiple component pairs in a single API call
 * @param {Array} pairs [{ id, c1, c2 }]
 * @returns {Map<id, boolean>}
 */
async function batchStructuralMatch(pairs) {
    if (!pairs.length) return new Map();

    console.log(`🤖 Batch AI: Comparing ${pairs.length} component pairs...`);

    const prompt = `
You are a UI component matcher.

Rules:
- Ignore dynamic text (price, count, miles, distances).
- Match semantic role + structure.
- Same meaning + same structure = Y
- Otherwise = N

Input:
${pairs
            .map(
                (p, i) =>
                    `${i + 1}) C1=n:${p.c1.name}|t:${p.c1.recipe.text}|b:${p.c1.recipe.buttons}  ` +
                    `C2=n:${p.c2.name}|t:${p.c2.recipe.text}|b:${p.c2.recipe.buttons}`
            )
            .join('\n')}

Output format:
<index>:Y or <index>:N
`.trim();

    const callAI = async (token) =>
        axios.post(
            CATALYST_API_URL,
            {
                prompt,
                model: 'crm-di-qwen_text_14b-fp8-it',
                system_prompt: 'You are a strict binary classifier. Respond only in the requested format.',
                temperature: 0,
                max_tokens: pairs.length * 5
            },
            {
                headers: {
                    'CATALYST-ORG': CATALYST_ORG,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

    let token = process.env.CATALYST_ACCESS_TOKEN;
    let response;

    try {
        response = await callAI(token);
    } catch (err) {
        if (err.response?.status === 401) {
            console.log('🔄 Catalyst token expired. Refreshing...');
            execSync('node refresh-token.js');
            dotenv.config({ override: true });
            token = process.env.CATALYST_ACCESS_TOKEN;
            response = await callAI(token);
        } else {
            throw err;
        }
    }

    const resultMap = new Map();
    const lines = response.data.response.split('\n');

    lines.forEach((line) => {
        const match = line.match(/(\d+):([YN])/i);
        if (match) {
            const idx = Number(match[1]) - 1;
            const val = match[2].toUpperCase() === 'Y';
            if (pairs[idx]) {
                resultMap.set(pairs[idx].id, val);
                console.log(`   ${pairs[idx].id}: ${val ? '✅ Match' : '❌ No match'}`);
            }
        }
    });

    return resultMap;
}

// Batch queue for debounced processing
const comparisonQueue = [];
let flushTimer = null;

/**
 * Check if two components are semantically and structurally similar
 * Uses batched AI calls for efficiency
 * @param {Object} group1 - First component group
 * @param {Object} group2 - Second component group
 * @returns {Promise<boolean>}
 */
export function areComponentsSimilar(group1, group2) {
    return new Promise((resolve) => {
        // 🔒 Hard deterministic filters (FAST - no AI needed)

        // Different structure = definitely not similar
        if (
            group1.recipe.text !== group2.recipe.text ||
            group1.recipe.buttons !== group2.recipe.buttons
        ) {
            return resolve(false);
        }

        // Exact name + signature match = definitely similar
        if (
            group1.name === group2.name &&
            group1.signature === group2.signature
        ) {
            return resolve(true);
        }

        // Ambiguous case - queue for AI analysis
        const id = `${group1.name}__${group2.name}`;

        comparisonQueue.push({
            id,
            c1: group1,
            c2: group2,
            resolve
        });

        // Debounce flush (batch window)
        if (!flushTimer) {
            flushTimer = setTimeout(async () => {
                const batch = comparisonQueue.splice(0);
                flushTimer = null;

                try {
                    const results = await batchStructuralMatch(batch);

                    batch.forEach((item) => {
                        item.resolve(results.get(item.id) ?? false);
                    });
                } catch (err) {
                    console.error('❌ Batch AI failure:', err.message);
                    // Fallback to simple name matching
                    batch.forEach((item) =>
                        item.resolve(
                            item.c1.name.toLowerCase() === item.c2.name.toLowerCase()
                        )
                    );
                }
            }, 30); // 30ms batch window
        }
    });
}

/**
 * Compare components across platforms using AI-powered matching
 * @param {Array} androidGroups - Android component groups
 * @param {Array} iosGroups - iOS component groups
 * @param {Array} webGroups - Web component groups
 * @returns {Promise<Object>} Comparison results
 */
export async function compareComponentsWithAI(androidGroups, iosGroups, webGroups) {
    console.log('\n🤖 Starting AI-powered component comparison...');

    const results = {
        android: {
            total: androidGroups.length,
            text: 0,
            buttons: 0
        },
        ios: {
            total: iosGroups.length,
            text: 0,
            buttons: 0
        },
        web: {
            total: webGroups.length,
            text: 0,
            buttons: 0
        },
        consistent: 0,
        inconsistent: 0,
        mapping: {
            text: [],
            buttons: [],
            recipes: []
        }
    };

    // Get all unique component names
    const allNames = new Set([
        ...androidGroups.map(g => g.name),
        ...iosGroups.map(g => g.name),
        ...webGroups.map(g => g.name)
    ]);

    console.log(`🔍 Analyzing ${allNames.size} unique components...`);

    // Build comparison matrix
    for (const name of allNames) {
        const android = androidGroups.find(g => g.name === name);
        const ios = iosGroups.find(g => g.name === name);
        const web = webGroups.find(g => g.name === name);

        const platforms = [];
        if (android) platforms.push('Android');
        if (ios) platforms.push('iOS');
        if (web) platforms.push('Web');

        // Check if all three platforms have this component
        if (platforms.length === 3) {
            // Use batched AI to check if they're structurally similar
            const [androidIosSimilar, androidWebSimilar, iosWebSimilar] = await Promise.all([
                areComponentsSimilar(android, ios),
                areComponentsSimilar(android, web),
                areComponentsSimilar(ios, web)
            ]);

            const allMatch = androidIosSimilar && androidWebSimilar && iosWebSimilar;

            if (allMatch) {
                results.consistent++;
                results.mapping.text.push({
                    name: `${name}`,
                    platforms: platforms.join(', '),
                    countInfo: `Count: 1 across all`,
                    icon: '✅',
                    details: '✅ Structurally Perfect & Counts Match'
                });
            } else {
                results.inconsistent++;
                results.mapping.text.push({
                    name: `${name}`,
                    platforms: platforms.join(', '),
                    countInfo: `Structure varies`,
                    icon: '⚠️',
                    details: 'Structural Mismatch'
                });
            }
        } else {
            // Missing from some platforms
            results.inconsistent++;
            const missing = [];
            if (!android) missing.push('Android');
            if (!ios) missing.push('iOS');
            if (!web) missing.push('Web');

            const recipe = android?.recipe || ios?.recipe || web?.recipe;

            results.mapping.text.push({
                name: `${name}`,
                platforms: platforms.join(', '),
                countInfo: `Missing from: ${missing.join(', ')}`,
                icon: '⚠️',
                details: `Missing on: ${missing.join(', ')}`
            });
        }
    }

    console.log(`✅ AI Analysis complete: ${results.consistent} consistent, ${results.inconsistent} inconsistent\n`);

    return results;
}
