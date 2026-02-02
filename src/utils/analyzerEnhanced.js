// Enhanced analyzer with QuickML AI integration
// Combines traditional JSON parsing with AI-powered visual analysis

import { analyzeDesignWithAI, compareComponentsAcrossPlatforms, getFigmaDesignImage } from './quickMLApi'

/**
 * Enhanced feature extraction with AI support
 */
export function extractFeatures(documentNode) {
    const features = {
        text: [],
        buttons: [],
        inputs: [],
        images: [],
        icons: [],
        all: []
    }

    function traverse(node) {
        if (!node) return

        const feature = {
            id: node.id,
            name: node.name,
            type: node.type
        }

        // Extract text content
        if (node.type === 'TEXT' && node.characters) {
            feature.text = node.characters
            features.text.push(feature)
            features.all.push({ ...feature, category: 'text' })
        }

        // Detect buttons (components/instances with button-like names)
        if ((node.type === 'COMPONENT' || node.type === 'INSTANCE' || node.type === 'FRAME') &&
            (node.name.toLowerCase().includes('button') ||
                node.name.toLowerCase().includes('btn') ||
                node.name.toLowerCase().includes('cta'))) {

            // Try to get button text from children
            if (node.children) {
                const textChild = node.children.find(child => child.type === 'TEXT')
                if (textChild && textChild.characters) {
                    feature.text = textChild.characters
                }
            }

            features.buttons.push(feature)
            features.all.push({ ...feature, category: 'button' })
        }

        // Detect input fields
        if ((node.type === 'COMPONENT' || node.type === 'INSTANCE' || node.type === 'FRAME') &&
            (node.name.toLowerCase().includes('input') ||
                node.name.toLowerCase().includes('field') ||
                node.name.toLowerCase().includes('textfield') ||
                node.name.toLowerCase().includes('search'))) {

            if (node.children) {
                const textChild = node.children.find(child => child.type === 'TEXT')
                if (textChild && textChild.characters) {
                    feature.text = textChild.characters
                }
            }

            features.inputs.push(feature)
            features.all.push({ ...feature, category: 'input' })
        }

        // Detect icons
        if ((node.type === 'COMPONENT' || node.type === 'INSTANCE') &&
            (node.name.toLowerCase().includes('icon') ||
                node.name.toLowerCase().includes('ico'))) {
            features.icons.push(feature)
            features.all.push({ ...feature, category: 'icon' })
        }

        // Detect images
        if (node.type === 'RECTANGLE' && node.fills && node.fills.some(fill => fill.type === 'IMAGE')) {
            features.images.push(feature)
            features.all.push({ ...feature, category: 'image' })
        }

        // Recursively process children
        if (node.children && Array.isArray(node.children)) {
            node.children.forEach(child => traverse(child))
        }
    }

    traverse(documentNode)
    return features
}

/**
 * Enhanced comparison with AI-powered semantic matching
 */
export function compareFeatures(androidFeatures, iosFeatures, webFeatures) {
    const results = {
        android: {
            total: androidFeatures.all.length,
            text: androidFeatures.text.length,
            buttons: androidFeatures.buttons.length,
            inputs: androidFeatures.inputs.length,
            icons: androidFeatures.icons.length
        },
        ios: {
            total: iosFeatures.all.length,
            text: iosFeatures.text.length,
            buttons: iosFeatures.buttons.length,
            inputs: iosFeatures.inputs.length,
            icons: iosFeatures.icons.length
        },
        web: {
            total: webFeatures.all.length,
            text: webFeatures.text.length,
            buttons: webFeatures.buttons.length,
            inputs: webFeatures.inputs.length,
            icons: webFeatures.icons.length
        },
        consistent: 0,
        inconsistent: 0,
        mapping: {
            text: [],
            buttons: [],
            inputs: [],
            icons: [],
            semanticMatches: [] // AI-detected semantic matches
        }
    }

    // Traditional text-based comparison
    const allTextContent = new Set()
    androidFeatures.text.forEach(t => allTextContent.add(t.text))
    iosFeatures.text.forEach(t => allTextContent.add(t.text))
    webFeatures.text.forEach(t => allTextContent.add(t.text))

    allTextContent.forEach(text => {
        const inAndroid = androidFeatures.text.some(t => t.text === text)
        const inIOS = iosFeatures.text.some(t => t.text === text)
        const inWeb = webFeatures.text.some(t => t.text === text)

        const platforms = []
        if (inAndroid) platforms.push('Android')
        if (inIOS) platforms.push('iOS')
        if (inWeb) platforms.push('Web')

        const isConsistent = platforms.length === 3

        results.mapping.text.push({
            name: text,
            platforms: platforms.join(', '),
            icon: isConsistent ? '✅' : '⚠️',
            consistent: isConsistent
        })

        if (isConsistent) {
            results.consistent++
        } else {
            results.inconsistent++
        }
    })

    // Button comparison
    const allButtonTexts = new Set()
    androidFeatures.buttons.forEach(b => b.text && allButtonTexts.add(b.text))
    iosFeatures.buttons.forEach(b => b.text && allButtonTexts.add(b.text))
    webFeatures.buttons.forEach(b => b.text && allButtonTexts.add(b.text))

    allButtonTexts.forEach(text => {
        const inAndroid = androidFeatures.buttons.some(b => b.text === text)
        const inIOS = iosFeatures.buttons.some(b => b.text === text)
        const inWeb = webFeatures.buttons.some(b => b.text === text)

        const platforms = []
        if (inAndroid) platforms.push('Android')
        if (inIOS) platforms.push('iOS')
        if (inWeb) platforms.push('Web')

        const isConsistent = platforms.length === 3

        results.mapping.buttons.push({
            name: text,
            platforms: platforms.join(', '),
            icon: isConsistent ? '✅' : '⚠️',
            consistent: isConsistent
        })

        if (isConsistent) {
            results.consistent++
        } else {
            results.inconsistent++
        }
    })

    // Input field comparison
    const allInputTexts = new Set()
    androidFeatures.inputs.forEach(i => i.text && allInputTexts.add(i.text))
    iosFeatures.inputs.forEach(i => i.text && allInputTexts.add(i.text))
    webFeatures.inputs.forEach(i => i.text && allInputTexts.add(i.text))

    allInputTexts.forEach(text => {
        const inAndroid = androidFeatures.inputs.some(i => i.text === text)
        const inIOS = iosFeatures.inputs.some(i => i.text === text)
        const inWeb = webFeatures.inputs.some(i => i.text === text)

        const platforms = []
        if (inAndroid) platforms.push('Android')
        if (inIOS) platforms.push('iOS')
        if (inWeb) platforms.push('Web')

        const isConsistent = platforms.length === 3

        results.mapping.inputs.push({
            name: text || 'Input Field',
            platforms: platforms.join(', '),
            icon: isConsistent ? '✅' : '⚠️',
            consistent: isConsistent
        })
    })

    return results
}

/**
 * AI-Enhanced comparison using QuickML Vision
 * This provides semantic matching beyond simple text comparison
 */
export async function compareWithAI(androidJson, iosJson, webJson, figmaAccessToken) {
    try {
        // First, get traditional analysis
        const androidFeatures = extractFeatures(androidJson.document)
        const iosFeatures = extractFeatures(iosJson.document)
        const webFeatures = extractFeatures(webJson.document)

        const traditionalResults = compareFeatures(androidFeatures, iosFeatures, webFeatures)

        // Note: To use AI analysis, we would need to:
        // 1. Extract the main frame/screen node IDs from each platform
        // 2. Fetch images from Figma API
        // 3. Send to QuickML for analysis

        // For now, return traditional results with AI placeholder
        traditionalResults.aiAnalysis = {
            enabled: false,
            message: 'AI analysis requires Figma image rendering. Enable in settings.'
        }

        return traditionalResults
    } catch (error) {
        console.error('AI comparison error:', error)
        // Fallback to traditional comparison
        const androidFeatures = extractFeatures(androidJson.document)
        const iosFeatures = extractFeatures(iosJson.document)
        const webFeatures = extractFeatures(webJson.document)
        return compareFeatures(androidFeatures, iosFeatures, webFeatures)
    }
}

/**
 * Semantic component matching using AI
 * Matches components by function, not just text
 */
export function findSemanticMatches(aiAnalysisResults) {
    const semanticMatches = []

    if (!aiAnalysisResults || !aiAnalysisResults.mapping) {
        return semanticMatches
    }

    // Example: Search bar on Android = Search icon on iOS
    // The AI analysis would identify these as functionally equivalent

    aiAnalysisResults.mapping.forEach(match => {
        if (match.purpose === 'search') {
            semanticMatches.push({
                function: 'Search',
                android: match.android,
                ios: match.ios,
                web: match.web,
                note: 'Functionally equivalent despite different visual representations',
                consistent: match.consistent
            })
        }
    })

    return semanticMatches
}

/**
 * Generates AI-enhanced insights
 */
export function generateAIInsights(traditionalResults, aiResults) {
    const insights = []

    // Compare traditional vs AI results
    if (aiResults && aiResults.mapping) {
        // Find components that AI detected but traditional analysis missed
        const aiDetected = aiResults.mapping.filter(item => {
            const traditionalFound = traditionalResults.mapping.text.some(t =>
                t.name.toLowerCase().includes(item.purpose.toLowerCase())
            )
            return !traditionalFound
        })

        if (aiDetected.length > 0) {
            insights.push({
                type: 'ai-discovery',
                title: 'AI Discovered Additional Matches',
                description: `Found ${aiDetected.length} semantically similar components that differ visually`,
                items: aiDetected
            })
        }
    }

    // Identify potential UX inconsistencies
    const inconsistentComponents = [
        ...traditionalResults.mapping.text,
        ...traditionalResults.mapping.buttons,
        ...traditionalResults.mapping.inputs
    ].filter(item => !item.consistent)

    if (inconsistentComponents.length > 0) {
        insights.push({
            type: 'inconsistency',
            title: 'UX Inconsistencies Detected',
            description: `${inconsistentComponents.length} components are not present across all platforms`,
            items: inconsistentComponents
        })
    }

    return insights
}
