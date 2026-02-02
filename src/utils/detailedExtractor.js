/**
 * Enhanced Feature Extractor for LLM
 * Extracts rich component information including type, hierarchy, and children
 */

/**
 * Extracts detailed component information for LLM analysis
 * @param {Object} documentNode - Figma document node
 * @returns {Array} Array of component objects with rich metadata
 */
export function extractDetailedComponents(documentNode) {
    const components = [];

    function traverse(node, depth = 0, parentName = '') {
        if (!node || depth > 15) return; // Prevent infinite recursion

        const nodeType = node.type;
        const nodeName = node.name || '';
        const hasChildren = node.children && node.children.length > 0;

        // Extract component with rich metadata
        const component = {
            name: nodeName,
            type: nodeType,
            depth: depth,
            parent: parentName
        };

        // Add text content if available
        if (nodeType === 'TEXT' && node.characters) {
            component.text = node.characters.trim();
        }

        // Add children count and types
        if (hasChildren) {
            component.childrenCount = node.children.length;
            component.childrenTypes = [...new Set(node.children.map(c => c.type))].join(', ');

            // List child names for context
            const childNames = node.children
                .map(c => c.name)
                .filter(n => n && n.trim())
                .slice(0, 5); // Limit to first 5
            if (childNames.length > 0) {
                component.contains = childNames.join(', ');
            }
        }

        // Only include meaningful components
        const meaningfulTypes = [
            'COMPONENT', 'INSTANCE', 'FRAME', 'GROUP',
            'TEXT', 'RECTANGLE', 'VECTOR', 'ELLIPSE',
            'LINE', 'POLYGON', 'STAR', 'BOOLEAN_OPERATION'
        ];

        if (meaningfulTypes.includes(nodeType) && nodeName.trim()) {
            components.push(component);
        }

        // Traverse children
        if (hasChildren) {
            node.children.forEach(child => traverse(child, depth + 1, nodeName));
        }
    }

    if (documentNode) {
        traverse(documentNode);
    }

    return components;
}

/**
 * Formats component for LLM display
 * @param {Object} component - Component object
 * @returns {string} Formatted string
 */
export function formatComponentForLLM(component) {
    let parts = [];

    // Name and type
    parts.push(`${component.name} [${component.type}]`);

    // Add text content if available
    if (component.text) {
        parts.push(`"${component.text}"`);
    }

    // Add structure information
    if (component.contains) {
        parts.push(`(contains: ${component.contains})`);
    } else if (component.childrenTypes) {
        parts.push(`(has ${component.childrenCount} children: ${component.childrenTypes})`);
    }

    return parts.join(' ');
}

/**
 * Groups components by type for better organization
 * @param {Array} components - Array of components
 * @returns {Object} Components grouped by type
 */
export function groupComponentsByType(components) {
    const grouped = {
        frames: [],
        components: [],
        text: [],
        icons: [],
        vectors: [],
        others: []
    };

    components.forEach(comp => {
        switch (comp.type) {
            case 'FRAME':
            case 'GROUP':
                grouped.frames.push(comp);
                break;
            case 'COMPONENT':
            case 'INSTANCE':
                grouped.components.push(comp);
                break;
            case 'TEXT':
                grouped.text.push(comp);
                break;
            case 'VECTOR':
            case 'ELLIPSE':
            case 'LINE':
            case 'POLYGON':
            case 'STAR':
                grouped.vectors.push(comp);
                break;
            case 'RECTANGLE':
                // Could be icon or background
                if (comp.name.toLowerCase().includes('icon')) {
                    grouped.icons.push(comp);
                } else {
                    grouped.others.push(comp);
                }
                break;
            default:
                grouped.others.push(comp);
        }
    });

    return grouped;
}
