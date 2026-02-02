/**
 * Enhanced Hierarchical Feature Extractor
 * Captures detailed component inventory with icon names and counts
 */

/**
 * Extract detailed hierarchical structure from Figma node
 * Returns nested tree with full component details
 */
function extractDetailedHierarchy(node, depth = 0, maxDepth = 15) {
    if (!node || depth > maxDepth) return null;

    const structure = {
        type: node.type,
        name: node.name || 'Unnamed',
        id: node.id,
        depth: depth
    };

    // Classify component type
    if (node.type === 'TEXT') {
        structure.componentType = 'text';
        structure.textContent = (node.characters || '').substring(0, 50);
    } else if (isIcon(node)) {
        structure.componentType = 'icon';
        structure.iconName = node.name;
    } else if (isButton(node)) {
        structure.componentType = 'button';
    } else if (node.type === 'FRAME' || node.type === 'GROUP') {
        structure.componentType = 'container';
    } else if (node.type === 'INSTANCE') {
        structure.componentType = 'instance';
        structure.instanceName = node.name;
    }

    // Recursively process children
    if (node.children && node.children.length > 0) {
        structure.children = node.children
            .map(child => extractDetailedHierarchy(child, depth + 1, maxDepth))
            .filter(Boolean);
    }

    return structure;
}

/**
 * Check if node is an icon
 */
function isIcon(node) {
    const name = (node.name || '').toLowerCase();
    return (
        name.includes('icon') ||
        name.includes(':') || // e.g., lineicons:search-2
        name.includes('/') || // e.g., heroicons-outline/bell
        name.includes('mynai') ||
        (node.type === 'INSTANCE' && (name.includes('icon') || name.includes(':')))
    );
}

/**
 * Check if node is a button
 */
function isButton(node) {
    const name = (node.name || '').toLowerCase();
    return name.includes('button') || name.includes('btn') || name.includes('cta');
}

/**
 * Create detailed component inventory from structure
 */
function createComponentInventory(structure) {
    const inventory = {
        texts: [],
        icons: [],
        buttons: [],
        frames: [],
        instances: []
    };

    function traverse(node, path = []) {
        if (!node) return;

        const currentPath = [...path, node.name];

        // Categorize component
        if (node.componentType === 'text') {
            inventory.texts.push({
                name: node.name,
                path: currentPath.join(' > '),
                content: node.textContent
            });
        } else if (node.componentType === 'icon') {
            inventory.icons.push({
                name: node.iconName || node.name,
                path: currentPath.join(' > ')
            });
        } else if (node.componentType === 'button') {
            inventory.buttons.push({
                name: node.name,
                path: currentPath.join(' > ')
            });
        } else if (node.componentType === 'container') {
            inventory.frames.push({
                name: node.name,
                path: currentPath.join(' > '),
                childCount: node.children?.length || 0
            });
        } else if (node.componentType === 'instance') {
            inventory.instances.push({
                name: node.instanceName || node.name,
                path: currentPath.join(' > ')
            });
        }

        // Traverse children
        if (node.children) {
            node.children.forEach(child => traverse(child, currentPath));
        }
    }

    traverse(structure);

    return inventory;
}

/**
 * Count icon occurrences by name
 */
function countIconsByName(inventory) {
    const iconCounts = {};

    inventory.icons.forEach(icon => {
        const name = icon.name;
        iconCounts[name] = (iconCounts[name] || 0) + 1;
    });

    return Object.entries(iconCounts).map(([name, count]) => ({
        name,
        count
    }));
}

/**
 * Create compact string representation with detailed components
 */
function createDetailedString(structure, inventory) {
    const iconCounts = countIconsByName(inventory);

    let result = `Component Inventory:\n`;

    // Icons with specific names
    if (iconCounts.length > 0) {
        iconCounts.forEach(icon => {
            result += `• ${icon.name} - ${icon.count}\n`;
        });
    }

    // Generic counts
    if (inventory.texts.length > 0) {
        result += `• Text Elements - ${inventory.texts.length}\n`;
    }

    if (inventory.buttons.length > 0) {
        result += `• Buttons - ${inventory.buttons.length}\n`;
    }

    // Detailed Frame Tracking
    if (inventory.frames.length > 1) {
        // Find unique frame names (excluding root and Generic names)
        const frameNames = inventory.frames
            .map(f => f.name)
            .filter(name => name !== structure.name && !name.startsWith('Frame') && !name.startsWith('Group'));

        const frameCounts = {};
        frameNames.forEach(n => { frameCounts[n] = (frameCounts[n] || 0) + 1; });

        Object.entries(frameCounts).forEach(([name, count]) => {
            result += `• Frame: ${name} - ${count}\n`;
        });

        // Count generic ones
        const genericCount = inventory.frames.length - 1 - frameNames.length;
        if (genericCount > 0) {
            result += `• Other Nested Frames - ${genericCount}\n`;
        }
    }

    return result;
}

/**
 * Extract meaningful feature-level components
 */
function extractCardsWithDetails(structure, cards = [], depth = 0) {
    if (!structure || depth > 10) return cards;

    // A feature Frame must have children and a minimum size/complexity to be semantically significant
    const isMainFeature = (
        structure.type === 'FRAME' &&
        structure.children &&
        structure.children.length >= 2 &&
        (
            (structure.name || '').toLowerCase().includes('card') ||
            (structure.name || '').toLowerCase().includes('item') ||
            (structure.name || '').toLowerCase().includes('section') ||
            (structure.name || '').toLowerCase().includes('header') ||
            (structure.name || '').toLowerCase().includes('bar') ||
            hasCardPattern(structure)
        )
    );

    if (isMainFeature) {
        const inventory = createComponentInventory(structure);
        const iconCounts = countIconsByName(inventory);

        // Skip extremely simple frames that are likely design noise
        if (inventory.texts.length > 0 || inventory.buttons.length > 0) {
            cards.push({
                name: structure.name,
                id: structure.id,
                inventory: {
                    texts: inventory.texts.length,
                    icons: iconCounts,
                    buttons: inventory.buttons.length,
                    frames: inventory.frames.length,
                    instances: inventory.instances.length
                },
                detailedString: createDetailedString(structure, inventory),
                fullStructure: structure
            });

            // CRITICAL: Once we find a feature, don't look for features INSIDE it 
            // unless they are explicitly named sub-items. This prevents the 8000+ count issue.
            return cards;
        }
    }

    // Recursively check children
    if (structure.children) {
        structure.children.forEach(child => extractCardsWithDetails(child, cards, depth + 1));
    }

    return cards;
}

/**
 * Check if structure matches card pattern
 */
function hasCardPattern(structure) {
    if (!structure.children) return false;

    const inventory = createComponentInventory(structure);
    const hasText = inventory.texts.length > 0;
    const hasIcon = inventory.icons.length > 0;
    const hasButton = inventory.buttons.length > 0;

    return hasText && (hasIcon || hasButton);
}

/**
 * Main function: Extract hierarchical features with detailed inventory
 */
export function extractHierarchicalFeatures(figmaDocument) {
    console.log('📊 Extracting detailed hierarchical structure...');

    // Build full tree
    const tree = extractDetailedHierarchy(figmaDocument);

    // Extract cards with detailed inventory
    const cards = extractCardsWithDetails(tree);

    console.log(`   Found ${cards.length} card-like structures`);

    // Log detailed inventory for first card (for debugging)
    if (cards.length > 0) {
        console.log(`\n   Example card: ${cards[0].name}`);
        console.log(`   ${cards[0].detailedString}`);
    }

    return {
        fullTree: tree,
        cards: cards,
        summary: {
            totalCards: cards.length,
            cardNames: cards.map(c => c.name)
        }
    };
}

/**
 * Extract hierarchical features grouped by page
 */
export function extractHierarchicalFeaturesByPage(figmaDocument) {
    if (!figmaDocument || !figmaDocument.children) return [];

    console.log('📊 Grouping structures by page...');

    // Top-level children of Figma document are CANVAS (Pages)
    const pages = figmaDocument.children.filter(child => child.type === 'CANVAS');

    return pages.map(page => {
        const tree = extractDetailedHierarchy(page);
        let cards = extractCardsWithDetails(tree);

        // Limit to top 100 components per page to keep AI analysis efficient and stable
        if (cards.length > 100) {
            console.log(`   ⚠️ Page ${page.name} has ${cards.length} features. Truncating to 100 for stability.`);
            cards = cards.slice(0, 100);
        }

        return {
            pageName: page.name,
            cards: cards,
            summary: {
                totalCards: cards.length
            }
        };
    }).filter(p => p.cards.length > 0);
}

/**
 * Create compact representation for AI with detailed inventory
 */
export function createCompactRepresentation(hierarchicalFeatures, platformName) {
    const { cards } = hierarchicalFeatures;

    return {
        platform: platformName,
        totalCards: cards.length,
        cards: cards.map(card => ({
            name: card.name,
            inventory: card.inventory,
            detailedString: card.detailedString
        }))
    };
}
