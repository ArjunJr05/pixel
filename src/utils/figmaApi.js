// Figma API Integration
// Extracts file ID from Figma URL and fetches design data

export function extractFileIdFromUrl(url) {
  // Figma URL format: https://www.figma.com/file/{fileId}/{fileName}
  // or: https://www.figma.com/design/{fileId}/{fileName}
  const regex = /figma\.com\/(file|design)\/([a-zA-Z0-9]+)/
  const match = url.match(regex)
  return match ? match[2] : null
}

export async function fetchFigmaFile(fileId, accessToken) {
  if (!fileId || !accessToken) {
    throw new Error('File ID and Access Token are required')
  }

  // Validate token format
  const trimmedToken = accessToken.trim()
  if (!trimmedToken.startsWith('figd_')) {
    throw new Error('Invalid token format. Figma tokens should start with "figd_"')
  }

  const url = `https://api.figma.com/v1/files/${fileId}`

  try {
    const response = await fetch(url, {
      headers: {
        'X-Figma-Token': trimmedToken
      }
    })

    if (!response.ok) {
      // Get error details from response
      let errorDetails = ''
      try {
        const errorData = await response.json()
        errorDetails = errorData.message || errorData.err || ''
      } catch (e) {
        // Ignore JSON parse errors
      }

      if (response.status === 401) {
        throw new Error('Invalid access token. Please check your token and try again.')
      } else if (response.status === 403) {
        throw new Error('Access denied. Make sure you have permission to view this file and your token is valid.')
      } else if (response.status === 404) {
        throw new Error('File not found. Check if the URL is correct and the file exists.')
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again. Figma limits API requests to prevent abuse.')
      } else {
        const errorMsg = errorDetails
          ? `Figma API error (${response.status}): ${errorDetails}`
          : `Figma API error: ${response.status} ${response.statusText}`
        throw new Error(errorMsg)
      }
    }

    const data = await response.json()
    return transformFigmaData(data)
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Check your internet connection and try again.')
    }
    throw error
  }
}

function transformFigmaData(figmaResponse) {
  // Transform Figma API response to match our expected format
  const document = figmaResponse.document

  return {
    document: {
      id: document.id,
      name: figmaResponse.name,
      type: 'DOCUMENT',
      children: document.children.map(page => extractNodeData(page))
    }
  }
}

function extractNodeData(node) {
  const data = {
    id: node.id,
    name: node.name,
    type: node.type
  }

  // Extract text content
  if (node.type === 'TEXT' && node.characters) {
    data.characters = node.characters
  }

  // Extract children recursively
  if (node.children && node.children.length > 0) {
    data.children = node.children.map(child => extractNodeData(child))

    // For COMPONENT/INSTANCE, try to get text from first text child
    if ((node.type === 'COMPONENT' || node.type === 'INSTANCE') && !data.characters) {
      const firstTextChild = node.children.find(child => child.type === 'TEXT')
      if (firstTextChild && firstTextChild.characters) {
        data.characters = firstTextChild.characters
      }
    }
  }

  return data
}

export function validateFigmaUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' }
  }

  const fileId = extractFileIdFromUrl(url)
  if (!fileId) {
    return {
      valid: false,
      error: 'Invalid Figma URL. Expected format: https://www.figma.com/file/{fileId}/...'
    }
  }

  return { valid: true, fileId }
}

export function saveAccessToken(token) {
  if (token) {
    localStorage.setItem('figma_access_token', token)
  }
}

export function getAccessToken() {
  return localStorage.getItem('figma_access_token') || ''
}

export function clearAccessToken() {
  localStorage.removeItem('figma_access_token')
}
