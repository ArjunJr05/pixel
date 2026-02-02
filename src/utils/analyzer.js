export function extractFeatures(documentNode) {
  const features = {
    text: new Set(),
    buttons: new Set(),
    all: new Set()
  }

  traverse(documentNode, features)
  return features
}

function traverse(node, features) {
  if (!node) return

  const nodeType = node.type
  const nodeName = node.name || ''
  const hasChildren = node.children && node.children.length > 0

  // Extract TEXT elements
  if (nodeType === 'TEXT') {
    const text = node.characters || ''
    if (text.trim()) {
      const type = classifyTextElement(text, nodeName)
      const feature = { name: text.trim(), type }

      if (type === 'BUTTON') {
        features.buttons.add(JSON.stringify(feature))
      } else {
        features.text.add(JSON.stringify(feature))
      }
      features.all.add(JSON.stringify(feature))
    }
  }
  // Extract COMPONENTS and INSTANCES (even with children!)
  else if (nodeType === 'COMPONENT' || nodeType === 'INSTANCE') {
    if (nodeName.trim()) {
      const type = classifyComponent(nodeName)
      const feature = { name: nodeName, type }

      if (type === 'BUTTON') {
        features.buttons.add(JSON.stringify(feature))
      } else {
        features.text.add(JSON.stringify(feature))
      }
      features.all.add(JSON.stringify(feature))
    }
  }
  // Extract FRAMES and GROUPS (including icons!)
  else if (nodeType === 'GROUP' || nodeType === 'FRAME') {
    if (nodeName.trim()) {
      // Check if this is an icon (heroicons, material-symbols, etc.)
      const isIcon = isIconComponent(nodeName)

      if (isIcon || !hasChildren) {
        const type = isIcon ? 'ICON' : classifyGroup(nodeName)
        if (type !== 'OTHER') {
          const feature = { name: nodeName, type }

          if (type === 'BUTTON') {
            features.buttons.add(JSON.stringify(feature))
          } else {
            features.text.add(JSON.stringify(feature))
          }
          features.all.add(JSON.stringify(feature))
        }
      }
    }
  }

  // Traverse children
  if (hasChildren) {
    node.children.forEach(child => traverse(child, features))
  }
}

// Helper function to detect icon components
function isIconComponent(name) {
  const iconPatterns = [
    'heroicons',
    'material-symbols',
    'material-icons',
    'feather',
    'fontawesome',
    'icon',
    '/home',
    '/heart',
    '/map',
    '/explore',
    '/search',
    '/filter',
    '/menu',
    '/profile',
    '/settings'
  ]

  const lowerName = name.toLowerCase()
  return iconPatterns.some(pattern => lowerName.includes(pattern))
}

function classifyTextElement(text, nodeName) {
  const lowerText = text.toLowerCase()
  const lowerNodeName = nodeName.toLowerCase()

  if (lowerNodeName.includes('button') || lowerNodeName.includes('btn')) {
    return 'BUTTON'
  }

  const buttonKeywords = /^(sign in|sign up|login|register|submit|continue|next|back|cancel)$/
  if (buttonKeywords.test(lowerText)) {
    return 'BUTTON'
  }

  return 'TEXT'
}

function classifyComponent(componentName) {
  const lower = componentName.toLowerCase()

  if (lower.includes('button') || lower.includes('btn')) {
    return 'BUTTON'
  }

  return 'OTHER'
}

function classifyGroup(groupName) {
  const lower = groupName.toLowerCase()

  if (lower.includes('(button)') || lower.includes('button') || lower.includes('btn')) {
    return 'BUTTON'
  }

  return 'OTHER'
}

export function compareFeatures(android, ios, web) {
  const allFeatures = new Map()

  const addFeatures = (features, platform) => {
    features.all.forEach(featureStr => {
      const feature = JSON.parse(featureStr)
      const key = feature.name

      if (!allFeatures.has(key)) {
        allFeatures.set(key, {
          name: feature.name,
          type: feature.type,
          platforms: new Set()
        })
      }
      allFeatures.get(key).platforms.add(platform)
    })
  }

  addFeatures(android, 'Android')
  addFeatures(ios, 'iOS')
  addFeatures(web, 'Web')

  const mapping = {
    text: [],
    buttons: []
  }

  let consistent = 0
  let inconsistent = 0

  allFeatures.forEach(feature => {
    const platformCount = feature.platforms.size
    const platformsArray = Array.from(feature.platforms)
    const platformsStr = platformsArray.join(', ')

    let icon = '✅'
    if (platformCount === 3) {
      consistent++
    } else {
      inconsistent++
      icon = '⚠️'
    }

    const item = {
      name: feature.name,
      platforms: platformsStr,
      icon: icon
    }

    if (feature.type === 'BUTTON') {
      mapping.buttons.push(item)
    } else {
      mapping.text.push(item)
    }
  })

  mapping.text.sort((a, b) => a.name.localeCompare(b.name))
  mapping.buttons.sort((a, b) => a.name.localeCompare(b.name))

  return {
    android: {
      total: android.all.size,
      text: android.text.size,
      buttons: android.buttons.size
    },
    ios: {
      total: ios.all.size,
      text: ios.text.size,
      buttons: ios.buttons.size
    },
    web: {
      total: web.all.size,
      text: web.text.size,
      buttons: web.buttons.size
    },
    consistent,
    inconsistent,
    mapping
  }
}
