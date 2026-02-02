<script setup>
import { ref, computed, onMounted } from 'vue'
import { extractFeatures, compareFeatures } from './utils/analyzer'
import { jsPDF } from 'jspdf'
import {
  fetchFigmaFile,
  extractFileIdFromUrl,
  validateFigmaUrl,
  getAccessToken,
  saveAccessToken
} from './utils/figmaApi'

// Figma URLs
const androidUrl = ref('')
const iosUrl = ref('')
const webUrl = ref('')
const accessToken = ref('')

// Data
const androidJson = ref(null)
const iosJson = ref(null)
const webJson = ref(null)
const errorMessage = ref('')
const analysisComplete = ref(false)
const loading = ref(false)
const loadingPlatform = ref('')
const fetchProgress = ref({
  android: false,
  ios: false,
  web: false
})

const results = ref({
  android: { total: 0, text: 0, buttons: 0 },
  ios: { total: 0, text: 0, buttons: 0 },
  web: { total: 0, text: 0, buttons: 0 },
  consistent: 0,
  inconsistent: 0,
  mapping: {
    text: [],
    buttons: []
  }
})

onMounted(() => {
  accessToken.value = getAccessToken()
})

const canAnalyze = computed(() => {
  return androidUrl.value.trim() &&
         iosUrl.value.trim() &&
         webUrl.value.trim() &&
         accessToken.value.trim()
})

const saveToken = () => {
  saveAccessToken(accessToken.value)
  errorMessage.value = ''
}

const fetchDesigns = async () => {
  if (!canAnalyze.value) {
    errorMessage.value = 'Please provide all Figma URLs and access token'
    return
  }

  loading.value = true
  errorMessage.value = ''
  androidJson.value = null
  iosJson.value = null
  webJson.value = null
  fetchProgress.value = { android: false, ios: false, web: false }

  try {
    // Validate URLs
    const androidValidation = validateFigmaUrl(androidUrl.value)
    if (!androidValidation.valid) {
      throw new Error(`Android URL: ${androidValidation.error}`)
    }

    const iosValidation = validateFigmaUrl(iosUrl.value)
    if (!iosValidation.valid) {
      throw new Error(`iOS URL: ${iosValidation.error}`)
    }

    const webValidation = validateFigmaUrl(webUrl.value)
    if (!webValidation.valid) {
      throw new Error(`Web URL: ${webValidation.error}`)
    }

    // Fetch Android
    loadingPlatform.value = 'Android'
    androidJson.value = await fetchFigmaFile(androidValidation.fileId, accessToken.value)
    fetchProgress.value.android = true

    // Fetch iOS
    loadingPlatform.value = 'iOS'
    iosJson.value = await fetchFigmaFile(iosValidation.fileId, accessToken.value)
    fetchProgress.value.ios = true

    // Fetch Web
    loadingPlatform.value = 'Web'
    webJson.value = await fetchFigmaFile(webValidation.fileId, accessToken.value)
    fetchProgress.value.web = true

    // Analyze
    loadingPlatform.value = 'Analyzing'
    analyzeDesigns()

  } catch (error) {
    errorMessage.value = error.message
    loading.value = false
    loadingPlatform.value = ''
  }
}

const analyzeDesigns = () => {
  try {
    const androidFeatures = extractFeatures(androidJson.value.document)
    const iosFeatures = extractFeatures(iosJson.value.document)
    const webFeatures = extractFeatures(webJson.value.document)

    results.value = compareFeatures(androidFeatures, iosFeatures, webFeatures)
    analysisComplete.value = true
    loading.value = false
    loadingPlatform.value = ''
  } catch (error) {
    errorMessage.value = `Analysis error: ${error.message}`
    loading.value = false
    loadingPlatform.value = ''
  }
}

const generatePDF = () => {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let yPos = 20

  doc.setFontSize(20)
  doc.setFont(undefined, 'bold')
  doc.text('PixelCheck Analysis Report', pageWidth / 2, yPos, { align: 'center' })
  yPos += 15

  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPos, { align: 'center' })
  yPos += 15

  doc.setFontSize(14)
  doc.setFont(undefined, 'bold')
  doc.text('Summary', 20, yPos)
  yPos += 10

  doc.setFontSize(11)
  doc.setFont(undefined, 'normal')
  doc.text(`Android: ${results.value.android.total} features (${results.value.android.text} text, ${results.value.android.buttons} buttons)`, 25, yPos)
  yPos += 7
  doc.text(`iOS: ${results.value.ios.total} features (${results.value.ios.text} text, ${results.value.ios.buttons} buttons)`, 25, yPos)
  yPos += 7
  doc.text(`Web: ${results.value.web.total} features (${results.value.web.text} text, ${results.value.web.buttons} buttons)`, 25, yPos)
  yPos += 10

  doc.text(`Consistent across all platforms: ${results.value.consistent}`, 25, yPos)
  yPos += 7
  doc.text(`Inconsistent or missing: ${results.value.inconsistent}`, 25, yPos)
  yPos += 15

  if (results.value.mapping.text.length > 0) {
    doc.setFontSize(14)
    doc.setFont(undefined, 'bold')
    doc.text('Text Elements', 20, yPos)
    yPos += 10

    doc.setFontSize(10)
    doc.setFont(undefined, 'normal')
    results.value.mapping.text.forEach(item => {
      if (yPos > 270) {
        doc.addPage()
        yPos = 20
      }
      const status = item.icon === '✅' ? '[OK]' : '[!]'
      doc.text(`${status} "${item.name}"`, 25, yPos)
      yPos += 5
      doc.setFontSize(9)
      doc.text(`   Platforms: ${item.platforms}`, 25, yPos)
      yPos += 8
      doc.setFontSize(10)
    })
    yPos += 5
  }

  if (results.value.mapping.buttons.length > 0) {
    if (yPos > 250) {
      doc.addPage()
      yPos = 20
    }
    doc.setFontSize(14)
    doc.setFont(undefined, 'bold')
    doc.text('Buttons', 20, yPos)
    yPos += 10

    doc.setFontSize(10)
    doc.setFont(undefined, 'normal')
    results.value.mapping.buttons.forEach(item => {
      if (yPos > 270) {
        doc.addPage()
        yPos = 20
      }
      const status = item.icon === '✅' ? '[OK]' : '[!]'
      doc.text(`${status} "${item.name}"`, 25, yPos)
      yPos += 5
      doc.setFontSize(9)
      doc.text(`   Platforms: ${item.platforms}`, 25, yPos)
      yPos += 8
      doc.setFontSize(10)
    })
  }

  return doc
}

const downloadPDF = () => {
  const doc = generatePDF()
  const timestamp = new Date().toISOString().split('T')[0]
  doc.save(`PixelCheck-Report-${timestamp}.pdf`)
}

const reset = () => {
  androidUrl.value = ''
  iosUrl.value = ''
  webUrl.value = ''
  androidJson.value = null
  iosJson.value = null
  webJson.value = null
  errorMessage.value = ''
  analysisComplete.value = false
  loading.value = false
  loadingPlatform.value = ''
  fetchProgress.value = { android: false, ios: false, web: false }
  results.value = {
    android: { total: 0, text: 0, buttons: 0 },
    ios: { total: 0, text: 0, buttons: 0 },
    web: { total: 0, text: 0, buttons: 0 },
    consistent: 0,
    inconsistent: 0,
    mapping: {
      text: [],
      buttons: []
    }
  }
}
</script>

<template>
  <div class="container">
    <header class="header">
      <h1>🎨 PixelCheck - Automated Analysis</h1>
      <p class="subtitle">Automated UI Design Consistency Validator with Figma API</p>
    </header>

    <!-- Input Section -->
    <div class="input-section" v-if="!analysisComplete">
      <!-- Access Token -->
      <div class="token-card">
        <h3>🔑 Figma Access Token</h3>
        <p class="help-text">
          Get your token from:
          <a href="https://www.figma.com/developers/api#access-tokens" target="_blank">
            Figma Settings → Account → Personal Access Tokens
          </a>
        </p>
        <div class="token-input-group">
          <input
            v-model="accessToken"
            type="password"
            placeholder="figd_..."
            class="token-input"
            @blur="saveToken"
          />
          <button @click="saveToken" class="save-token-btn">💾 Save</button>
        </div>
      </div>

      <!-- URL Inputs -->
      <div class="url-grid">
        <div class="url-card" :class="{ 'fetched': fetchProgress.android }">
          <div class="platform-icon">📱</div>
          <h3>Android Design URL</h3>
          <input
            v-model="androidUrl"
            type="text"
            placeholder="https://www.figma.com/file/..."
            class="url-input"
            :disabled="loading"
          />
          <div class="status-indicator" v-if="fetchProgress.android">✅ Fetched</div>
        </div>

        <div class="url-card" :class="{ 'fetched': fetchProgress.ios }">
          <div class="platform-icon">🍎</div>
          <h3>iOS Design URL</h3>
          <input
            v-model="iosUrl"
            type="text"
            placeholder="https://www.figma.com/file/..."
            class="url-input"
            :disabled="loading"
          />
          <div class="status-indicator" v-if="fetchProgress.ios">✅ Fetched</div>
        </div>

        <div class="url-card" :class="{ 'fetched': fetchProgress.web }">
          <div class="platform-icon">🌐</div>
          <h3>Web Design URL</h3>
          <input
            v-model="webUrl"
            type="text"
            placeholder="https://www.figma.com/file/..."
            class="url-input"
            :disabled="loading"
          />
          <div class="status-indicator" v-if="fetchProgress.web">✅ Fetched</div>
        </div>
      </div>

      <div class="error-message" v-if="errorMessage">
        ⚠️ {{ errorMessage }}
      </div>

      <div class="loading-message" v-if="loading">
        <div class="spinner"></div>
        <p>{{ loadingPlatform ? `Fetching ${loadingPlatform} design...` : 'Processing...' }}</p>
        <div class="progress-steps">
          <div class="step" :class="{ 'active': fetchProgress.android }">
            <span class="step-icon">📱</span>
            <span class="step-label">Android</span>
          </div>
          <div class="step" :class="{ 'active': fetchProgress.ios }">
            <span class="step-icon">🍎</span>
            <span class="step-label">iOS</span>
          </div>
          <div class="step" :class="{ 'active': fetchProgress.web }">
            <span class="step-icon">🌐</span>
            <span class="step-label">Web</span>
          </div>
        </div>
      </div>

      <button
        class="analyze-btn"
        @click="fetchDesigns"
        :disabled="!canAnalyze || loading"
        :class="{ 'disabled': !canAnalyze || loading }"
      >
        {{ loading ? '⏳ Fetching & Analyzing...' : '🚀 Fetch & Analyze Automatically' }}
      </button>
    </div>

    <!-- Results Section -->
    <div class="results-section" v-if="analysisComplete">
      <div class="results-header">
        <h2>📊 Analysis Results</h2>
        <button class="reset-btn" @click="reset">↻ Analyze New Designs</button>
      </div>

      <!-- Summary -->
      <div class="summary-card">
        <h3>📈 Summary</h3>
        <div class="summary-grid">
          <div class="summary-item">
            <span class="platform-label">📱 Android:</span>
            <span>{{ results.android.total }} features ({{ results.android.text }} text, {{ results.android.buttons }} buttons)</span>
          </div>
          <div class="summary-item">
            <span class="platform-label">🍎 iOS:</span>
            <span>{{ results.ios.total }} features ({{ results.ios.text }} text, {{ results.ios.buttons }} buttons)</span>
          </div>
          <div class="summary-item">
            <span class="platform-label">🌐 Web:</span>
            <span>{{ results.web.total }} features ({{ results.web.text }} text, {{ results.web.buttons }} buttons)</span>
          </div>
        </div>
        <div class="consistency-stats">
          <div class="stat-item success">
            <span class="stat-icon">✅</span>
            <span>Consistent: {{ results.consistent }}</span>
          </div>
          <div class="stat-item warning">
            <span class="stat-icon">⚠️</span>
            <span>Inconsistent: {{ results.inconsistent }}</span>
          </div>
        </div>
      </div>

      <!-- Component Mapping -->
      <div class="mapping-section">
        <h3>📱 Component-to-Platform Mapping</h3>

        <div class="category-card" v-if="results.mapping.text.length > 0">
          <h4>📝 Text Elements</h4>
          <div class="component-list">
            <div
              class="component-item"
              v-for="item in results.mapping.text"
              :key="item.name"
            >
              <span class="status-icon">{{ item.icon }}</span>
              <span class="component-name">"{{ item.name }}"</span>
              <span class="platforms">{{ item.platforms }}</span>
            </div>
          </div>
        </div>

        <div class="category-card" v-if="results.mapping.buttons.length > 0">
          <h4>🔘 Buttons</h4>
          <div class="component-list">
            <div
              class="component-item"
              v-for="item in results.mapping.buttons"
              :key="item.name"
            >
              <span class="status-icon">{{ item.icon }}</span>
              <span class="component-name">"{{ item.name }}"</span>
              <span class="platforms">{{ item.platforms }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <button class="action-btn download-btn" @click="downloadPDF">
          📥 Download PDF Report
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  text-align: center;
  color: white;
  margin-bottom: 40px;
  padding: 30px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.header h1 {
  font-size: 2.5rem;
  margin-bottom: 10px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
}

.subtitle {
  font-size: 1.2rem;
  opacity: 0.9;
}

/* Input Section */
.input-section {
  background: white;
  border-radius: 20px;
  padding: 40px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

.token-card {
  background: #f8f9fa;
  border-radius: 15px;
  padding: 25px;
  margin-bottom: 30px;
  border: 2px solid #dee2e6;
}

.token-card h3 {
  color: #333;
  margin-bottom: 10px;
}

.help-text {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 15px;
}

.help-text a {
  color: #667eea;
  text-decoration: none;
}

.help-text a:hover {
  text-decoration: underline;
}

.token-input-group {
  display: flex;
  gap: 10px;
}

.token-input {
  flex: 1;
  padding: 12px 15px;
  border: 2px solid #dee2e6;
  border-radius: 10px;
  font-size: 1rem;
  font-family: monospace;
}

.token-input:focus {
  outline: none;
  border-color: #667eea;
}

.save-token-btn {
  padding: 12px 20px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
}

.save-token-btn:hover {
  background: #5568d3;
}

.url-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.url-card {
  background: #f8f9fa;
  border-radius: 15px;
  padding: 20px;
  border: 2px solid #dee2e6;
  transition: all 0.3s ease;
  position: relative;
}

.url-card:hover {
  border-color: #667eea;
  transform: translateY(-2px);
}

.url-card.fetched {
  background: #e8f5e9;
  border-color: #4caf50;
}

.platform-icon {
  font-size: 2.5rem;
  margin-bottom: 10px;
  text-align: center;
}

.url-card h3 {
  color: #333;
  font-size: 1.1rem;
  margin-bottom: 15px;
  text-align: center;
}

.url-input {
  width: 100%;
  padding: 12px 15px;
  border: 2px solid #dee2e6;
  border-radius: 10px;
  font-size: 0.95rem;
}

.url-input:focus {
  outline: none;
  border-color: #667eea;
}

.url-input:disabled {
  background: #e9ecef;
  cursor: not-allowed;
}

.status-indicator {
  margin-top: 10px;
  text-align: center;
  color: #4caf50;
  font-weight: 600;
  font-size: 0.9rem;
}

.error-message {
  background: #ffebee;
  color: #c62828;
  padding: 15px 20px;
  border-radius: 10px;
  margin-bottom: 20px;
  border-left: 4px solid #c62828;
}

.loading-message {
  background: #e3f2fd;
  color: #1976d2;
  padding: 20px;
  border-radius: 10px;
  margin-bottom: 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e3f2fd;
  border-top-color: #1976d2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.progress-steps {
  display: flex;
  gap: 20px;
  margin-top: 10px;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  opacity: 0.4;
  transition: all 0.3s ease;
}

.step.active {
  opacity: 1;
  transform: scale(1.1);
}

.step-icon {
  font-size: 1.5rem;
}

.step-label {
  font-size: 0.85rem;
  font-weight: 600;
}

.analyze-btn {
  width: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 18px 40px;
  font-size: 1.2rem;
  font-weight: 600;
  border-radius: 30px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 5px 20px rgba(102, 126, 234, 0.3);
}

.analyze-btn:hover:not(.disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(102, 126, 234, 0.4);
}

.analyze-btn.disabled {
  background: #ccc;
  cursor: not-allowed;
  box-shadow: none;
}

/* Results Section */
.results-section {
  background: white;
  border-radius: 20px;
  padding: 40px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #f0f0f0;
}

.results-header h2 {
  color: #333;
  font-size: 2rem;
}

.reset-btn {
  background: #667eea;
  color: white;
  border: none;
  padding: 12px 25px;
  border-radius: 20px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
}

.reset-btn:hover {
  background: #5568d3;
  transform: scale(1.05);
}

.summary-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 15px;
  padding: 30px;
  margin-bottom: 30px;
}

.summary-card h3 {
  font-size: 1.5rem;
  margin-bottom: 20px;
}

.summary-grid {
  display: grid;
  gap: 15px;
  margin-bottom: 20px;
}

.summary-item {
  background: rgba(255, 255, 255, 0.1);
  padding: 15px 20px;
  border-radius: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.platform-label {
  font-weight: 600;
  font-size: 1.1rem;
}

.consistency-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.stat-item {
  background: rgba(255, 255, 255, 0.15);
  padding: 15px 20px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
}

.stat-icon {
  font-size: 1.5rem;
}

.mapping-section {
  margin-top: 30px;
}

.mapping-section h3 {
  color: #333;
  font-size: 1.8rem;
  margin-bottom: 25px;
}

.category-card {
  background: #f8f9fa;
  border-radius: 15px;
  padding: 25px;
  margin-bottom: 20px;
}

.category-card h4 {
  color: #333;
  font-size: 1.3rem;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid #dee2e6;
}

.component-list {
  display: grid;
  gap: 10px;
}

.component-item {
  background: white;
  padding: 15px 20px;
  border-radius: 10px;
  display: grid;
  grid-template-columns: 40px 1fr auto;
  align-items: center;
  gap: 15px;
  transition: all 0.2s ease;
  border: 1px solid #e0e0e0;
}

.component-item:hover {
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
  transform: translateX(5px);
}

.status-icon {
  font-size: 1.3rem;
  text-align: center;
}

.component-name {
  color: #333;
  font-weight: 500;
}

.platforms {
  color: #667eea;
  font-weight: 600;
  background: #e8eaf6;
  padding: 5px 15px;
  border-radius: 20px;
  font-size: 0.9rem;
}

.action-buttons {
  display: flex;
  justify-content: center;
  margin-top: 30px;
  padding-top: 30px;
  border-top: 2px solid #f0f0f0;
}

.action-btn {
  padding: 15px 30px;
  font-size: 1.1rem;
  font-weight: 600;
  border: none;
  border-radius: 25px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.download-btn {
  background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
  color: white;
}

.download-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(76, 175, 80, 0.4);
}

/* Responsive Design */
@media (max-width: 768px) {
  .header h1 {
    font-size: 2rem;
  }

  .url-grid {
    grid-template-columns: 1fr;
  }

  .results-header {
    flex-direction: column;
    gap: 15px;
    align-items: flex-start;
  }

  .component-item {
    grid-template-columns: 30px 1fr;
    gap: 10px;
  }

  .platforms {
    grid-column: 2;
    justify-self: start;
  }

  .progress-steps {
    flex-direction: column;
    gap: 10px;
  }
}
</style>
