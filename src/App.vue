<script setup>
import { ref, computed } from 'vue'
import { extractFeatures, compareFeatures } from './utils/analyzer'
import { jsPDF } from 'jspdf'

const androidJson = ref(null)
const iosJson = ref(null)
const webJson = ref(null)
const androidFileName = ref('')
const iosFileName = ref('')
const webFileName = ref('')
const errorMessage = ref('')
const analysisComplete = ref(false)
const androidFileInput = ref(null)
const iosFileInput = ref(null)
const webFileInput = ref(null)
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

const canAnalyze = computed(() => {
  return androidJson.value && iosJson.value && webJson.value
})

const triggerFileInput = (platform) => {
  if (platform === 'android') {
    androidFileInput.value?.click()
  } else if (platform === 'ios') {
    iosFileInput.value?.click()
  } else if (platform === 'web') {
    webFileInput.value?.click()
  }
}

const handleFileUpload = (event, platform) => {
  const file = event.target.files[0]
  if (!file) return

  errorMessage.value = ''
  const reader = new FileReader()

  reader.onload = (e) => {
    try {
      const json = JSON.parse(e.target.result)

      if (!json.document) {
        throw new Error('Invalid JSON structure. Expected "document" property.')
      }

      if (platform === 'android') {
        androidJson.value = json
        androidFileName.value = file.name
      } else if (platform === 'ios') {
        iosJson.value = json
        iosFileName.value = file.name
      } else if (platform === 'web') {
        webJson.value = json
        webFileName.value = file.name
      }
    } catch (error) {
      errorMessage.value = `Error parsing ${platform} JSON: ${error.message}`
      event.target.value = ''
    }
  }

  reader.onerror = () => {
    errorMessage.value = `Error reading ${platform} file`
    event.target.value = ''
  }

  reader.readAsText(file)
}

const analyzeDesigns = () => {
  if (!canAnalyze.value) return

  try {
    const androidFeatures = extractFeatures(androidJson.value.document)
    const iosFeatures = extractFeatures(iosJson.value.document)
    const webFeatures = extractFeatures(webJson.value.document)

    results.value = compareFeatures(androidFeatures, iosFeatures, webFeatures)
    analysisComplete.value = true
  } catch (error) {
    errorMessage.value = `Analysis error: ${error.message}`
  }
}

const generatePDF = () => {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let yPos = 20

  // Title
  doc.setFontSize(20)
  doc.setFont(undefined, 'bold')
  doc.text('PixelCheck Analysis Report', pageWidth / 2, yPos, { align: 'center' })
  yPos += 15

  // Date
  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPos, { align: 'center' })
  yPos += 15

  // Summary Section
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

  // Text Elements
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

  // Buttons
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
  androidJson.value = null
  iosJson.value = null
  webJson.value = null
  androidFileName.value = ''
  iosFileName.value = ''
  webFileName.value = ''
  errorMessage.value = ''
  analysisComplete.value = false
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
    <!-- Header -->
    <header class="header">
      <h1>🎨 PixelCheck Extension</h1>
      <p class="subtitle">UI Design Consistency Validator</p>
    </header>

    <!-- File Upload Section -->
    <div class="upload-section" v-if="!analysisComplete">
      <div class="upload-grid">
        <div class="upload-card" :class="{ 'uploaded': androidJson }">
          <div class="upload-icon">📱</div>
          <h3>Android JSON</h3>
          <input
            ref="androidFileInput"
            type="file"
            @change="handleFileUpload($event, 'android')"
            accept=".json"
            style="display: none"
          >
          <button @click="triggerFileInput('android')" class="upload-btn">
            {{ androidJson ? '✓ Uploaded' : 'Choose File' }}
          </button>
          <p class="file-name" v-if="androidFileName">{{ androidFileName }}</p>
        </div>

        <div class="upload-card" :class="{ 'uploaded': iosJson }">
          <div class="upload-icon">🍎</div>
          <h3>iOS JSON</h3>
          <input
            ref="iosFileInput"
            type="file"
            @change="handleFileUpload($event, 'ios')"
            accept=".json"
            style="display: none"
          >
          <button @click="triggerFileInput('ios')" class="upload-btn">
            {{ iosJson ? '✓ Uploaded' : 'Choose File' }}
          </button>
          <p class="file-name" v-if="iosFileName">{{ iosFileName }}</p>
        </div>

        <div class="upload-card" :class="{ 'uploaded': webJson }">
          <div class="upload-icon">🌐</div>
          <h3>Web JSON</h3>
          <input
            ref="webFileInput"
            type="file"
            @change="handleFileUpload($event, 'web')"
            accept=".json"
            style="display: none"
          >
          <button @click="triggerFileInput('web')" class="upload-btn">
            {{ webJson ? '✓ Uploaded' : 'Choose File' }}
          </button>
          <p class="file-name" v-if="webFileName">{{ webFileName }}</p>
        </div>
      </div>

      <div class="error-message" v-if="errorMessage">
        ⚠️ {{ errorMessage }}
      </div>

      <button
        class="analyze-btn"
        @click="analyzeDesigns"
        :disabled="!canAnalyze"
        :class="{ 'disabled': !canAnalyze }"
      >
        🔍 Analyze Designs
      </button>
    </div>

    <!-- Results Section -->
    <div class="results-section" v-if="analysisComplete">
      <div class="results-header">
        <h2>📊 Analysis Results</h2>
        <button class="reset-btn" @click="reset">↻ Upload New Files</button>
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

        <!-- Text Elements -->
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

        <!-- Buttons -->
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
          📥 Download PDF
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

/* Header */
.header {
  text-align: center;
  color: white;
  margin-bottom: 40px;
  padding: 30px 20px;
  background: rgba(255, 255, 255, 0.1);
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

/* Upload Section */
.upload-section {
  background: white;
  border-radius: 20px;
  padding: 40px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

.upload-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 30px;
  margin-bottom: 30px;
}

.upload-card {
  background: #f8f9fa;
  border: 3px dashed #dee2e6;
  border-radius: 15px;
  padding: 30px;
  text-align: center;
  transition: all 0.3s ease;
}

.upload-card:hover {
  border-color: #667eea;
  transform: translateY(-5px);
  box-shadow: 0 5px 20px rgba(102, 126, 234, 0.2);
}

.upload-card.uploaded {
  background: #e8f5e9;
  border-color: #4caf50;
  border-style: solid;
}

.upload-icon {
  font-size: 3rem;
  margin-bottom: 15px;
}

.upload-card h3 {
  color: #333;
  margin-bottom: 20px;
  font-size: 1.3rem;
}

.upload-btn {
  display: inline-block;
  background: #667eea;
  color: white;
  padding: 12px 30px;
  border-radius: 25px;
  border: none;
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
  transition: all 0.3s ease;
}

.upload-btn:hover {
  background: #5568d3;
  transform: scale(1.05);
}

.upload-card.uploaded .upload-btn {
  background: #4caf50;
}

.file-name {
  margin-top: 15px;
  font-size: 0.9rem;
  color: #666;
  word-break: break-all;
}

.error-message {
  background: #ffebee;
  color: #c62828;
  padding: 15px 20px;
  border-radius: 10px;
  margin-bottom: 20px;
  border-left: 4px solid #c62828;
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

/* Summary Card */
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

/* Mapping Section */
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

/* Action Buttons */
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

  .upload-grid {
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
}
</style>
