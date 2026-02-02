/**
 * Node.js version of analyzer utilities for server-side use
 * Focused on Structural Analysis (Component Recipes)
 */

function extractFeatures(node, features = { text: [], buttons: [], groups: [] }) {
    if (!node) return features;

    // Check if it's a structural container (FRAME, GROUP, COMPONENT, INSTANCE)
    const containerTypes = ['FRAME', 'GROUP', 'COMPONENT', 'INSTANCE'];
    if (containerTypes.includes(node.type)) {
        const children = node.children || [];
        const textCount = children.filter(c => c.type === 'TEXT').length;
        const buttonCount = children.filter(c =>
            (c.name || '').toLowerCase().includes('button') ||
            (c.name || '').toLowerCase().includes('btn') ||
            (c.name || '').toLowerCase().includes('cta')
        ).length;

        // Only track meaningful groups (at least 2 children or a clear component)
        if (children.length > 1 || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
            // Extract semantic keywords for functional matching
            const semanticKeywords = extractSemanticKeywords(node.name || '');

            features.groups.push({
                name: node.name || 'Unnamed Group',
                id: node.id,
                type: node.type,
                recipe: {
                    text: textCount,
                    buttons: buttonCount,
                    total: children.length
                },
                // Create a structural signature: "T8B1" for 8 texts and 1 button
                signature: `T${textCount}B${buttonCount}`,
                semanticKeywords: semanticKeywords // For cross-platform matching
            });
        }
    }

    // Still extract individual features for fallback
    if (node.type === 'TEXT') {
        if (node.characters && node.characters.trim()) {
            features.text.push({
                name: node.name || node.characters.substring(0, 30),
                text: node.characters,
                id: node.id
            });
        }
    }

    // Check for buttons
    const buttonKeywords = ['button', 'btn', 'cta', 'action'];
    const nodeName = (node.name || '').toLowerCase();
    if (buttonKeywords.some(keyword => nodeName.includes(keyword)) && node.type !== 'TEXT') {
        features.buttons.push({
            name: node.name,
            id: node.id,
            type: node.type
        });
    }

    // Recursively process children
    if (node.children && Array.isArray(node.children)) {
        node.children.forEach(child => extractFeatures(child, features));
    }

    return features;
}

/**
 * Extract semantic keywords from component names for functional matching
 * E.g., "Search Bar", "lineicons:search-2", "Search Icon" all map to "search"
 */
function extractSemanticKeywords(name) {
    const normalized = name.toLowerCase();
    const keywords = [];

    // Define semantic categories
    const semanticMap = {
        search: ['search', 'find', 'query', 'lookup'],
        notification: ['bell', 'notification', 'alert', 'notify'],
        user: ['user', 'profile', 'account', 'avatar'],
        menu: ['menu', 'hamburger', 'nav', 'drawer'],
        filter: ['filter', 'sort', 'refine'],
        location: ['location', 'map', 'pin', 'marker', 'gps'],
        time: ['time', 'clock', 'schedule', 'calendar'],
        favorite: ['favorite', 'heart', 'like', 'bookmark', 'star']
    };

    // Check which categories this component belongs to
    for (const [category, terms] of Object.entries(semanticMap)) {
        if (terms.some(term => normalized.includes(term))) {
            keywords.push(category);
        }
    }

    return keywords;
}

/**
 * Find components with similar semantic meaning across platforms
 * Returns array of component names that serve the same function
 */
function findSemanticEquivalents(targetData, androidGroups, iosGroups, webGroups) {
    const equivalents = [];
    const targetKeywords = targetData.semanticKeywords || [];

    if (targetKeywords.length === 0) return equivalents;

    // Search in all provided platform groups
    const allGroups = [...androidGroups, ...iosGroups, ...webGroups];

    for (const group of allGroups) {
        const groupKeywords = group.semanticKeywords || [];

        // Check if there's any semantic overlap
        const hasCommonKeyword = targetKeywords.some(kw => groupKeywords.includes(kw));

        if (hasCommonKeyword && group.name !== targetData.name) {
            equivalents.push(group.name);
        }
    }

    return [...new Set(equivalents)]; // Remove duplicates
}

function compareFeatures(androidFeatures, iosFeatures, webFeatures) {
    const results = {
        android: {
            total: androidFeatures.groups.length,
            text: androidFeatures.text.length,
            buttons: androidFeatures.buttons.length
        },
        ios: {
            total: iosFeatures.groups.length,
            text: iosFeatures.text.length,
            buttons: iosFeatures.buttons.length
        },
        web: {
            total: webFeatures.groups.length,
            text: webFeatures.text.length,
            buttons: webFeatures.buttons.length
        },
        consistent: 0,
        inconsistent: 0,
        mapping: {
            text: [], // We use this for grouped components now
            buttons: [],
            recipes: []
        }
    };

    // --- STRUCTURAL INSTANCE MATCHING ---
    // Instead of just names, we use "Identity" (Name + Signature)
    const getIdentity = (g) => `${g.name}|${g.signature}`;

    console.log(`\n📊 STRUCTURAL ANALYSIS:`);
    console.log(`   Android: ${androidFeatures.groups.length} groups`);
    console.log(`   iOS: ${iosFeatures.groups.length} groups`);
    console.log(`   Web: ${webFeatures.groups.length} groups`);

    const identities = new Map();

    // Helper to add components to our identity map
    const trackIdentity = (platform, group) => {
        const id = getIdentity(group);
        if (!identities.has(id)) {
            identities.set(id, {
                name: group.name,
                signature: group.signature,
                recipe: group.recipe,
                counts: { Android: 0, iOS: 0, Web: 0 }
            });
        }
        identities.get(id).counts[platform]++;
    };

    androidFeatures.groups.forEach(g => trackIdentity('Android', g));
    iosFeatures.groups.forEach(g => trackIdentity('iOS', g));
    webFeatures.groups.forEach(g => trackIdentity('Web', g));

    // Compare counts across platforms
    console.log(`\n🔍 ANALYZING ${identities.size} UNIQUE IDENTITIES:\n`);

    identities.forEach((data, id) => {
        const { Android, iOS, Web } = data.counts;
        console.log(`   "${data.name}" [${data.signature}]: A=${Android}, I=${iOS}, W=${Web}`);

        const platformsPresent = [];
        if (Android > 0) platformsPresent.push('Android');
        if (iOS > 0) platformsPresent.push('iOS');
        if (Web > 0) platformsPresent.push('Web');

        // Check if consistent (Present on all 3, and counts match)
        const allPresent = platformsPresent.length === 3;
        const countsMatch = Android === iOS && iOS === Web;
        const isConsistent = allPresent && countsMatch;

        if (isConsistent) {
            results.consistent += Android; // Add all instances
            results.mapping.text.push({
                name: `${data.name}`,
                platforms: platformsPresent.join(', '),
                countInfo: `Count: ${Android} across all`,
                icon: '✅',
                details: '✅ Structurally Perfect & Counts Match'
            });
        } else {
            results.inconsistent += Math.max(Android, iOS, Web);

            let status = '';
            if (!allPresent) {
                const missing = [];
                if (Android === 0) missing.push('Android');
                if (iOS === 0) missing.push('iOS');
                if (Web === 0) missing.push('Web');

                // SMART CHECK: Before marking as missing, check if there's a functionally equivalent component
                const semanticEquivalents = findSemanticEquivalents(
                    data,
                    missing.includes('Android') ? androidFeatures.groups : [],
                    missing.includes('iOS') ? iosFeatures.groups : [],
                    missing.includes('Web') ? webFeatures.groups : []
                );

                if (semanticEquivalents.length > 0) {
                    console.log(`   🔄 SEMANTIC MATCH: "${data.name}" has alternatives: ${semanticEquivalents.join(', ')}`);
                    status = `🔄 Alternative Implementation Found: ${semanticEquivalents.join(', ')}`;
                    // Don't count as inconsistent if we found alternatives
                    results.inconsistent -= Math.max(Android, iOS, Web);
                    results.consistent += Math.max(Android, iOS, Web);
                } else {
                    status = `Missing on: ${missing.join(', ')}`;
                }
            } else if (!countsMatch) {
                status = `Count Mismatch (A:${Android}, I:${iOS}, W:${Web})`;
            }

            results.mapping.text.push({
                name: `${data.name}`,
                platforms: platformsPresent.join(', '),
                countInfo: `Counts - A:${Android}, I:${iOS}, W:${Web}`,
                icon: '⚠️',
                details: status
            });
        }
    });

    console.log(`\n✅ FINAL COUNTS:`);
    console.log(`   Consistent: ${results.consistent}`);
    console.log(`   Inconsistent: ${results.inconsistent}`);
    console.log(`   Total Mappings: ${results.mapping.text.length}\n`);

    return results;
}

export {
    extractFeatures,
    compareFeatures
};
