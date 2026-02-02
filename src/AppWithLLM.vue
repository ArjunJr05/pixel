<template>
  <div id="app" class="app-container">
    <header class="app-header">
      <div class="header-content">
        <h1 class="app-title">
          <span class="icon">🎯</span>
          PixelCheck AI
        </h1>
        <p class="app-subtitle">Cross-Platform UI Component Mapper</p>
        <p class="powered-by">Powered by Zoho Catalyst QuickML - Qwen 2.5 14B</p>
      </div>
    </header>

    <main class="main-content">
      <!-- Configuration Section -->
      <section class="config-section card">
        <h2 class="section-title">
          <span class="step-number">1</span>
          Configuration
        </h2>
        
        <div class="input-group">
          <label for="figma-token">
            <span class="label-icon">🔑</span>
            Figma Personal Access Token
          </label>
          <input
            id="figma-token"
            v-model="figmaToken"
            type="password"
            placeholder="figd_xxxxxxxxxxxxxxxxxxxxx"
            class="input-field"
          />
          <small class="input-hint">
            Get your token from <a href="https://www.figma.com/developers/api#access-tokens" target="_blank">Figma Settings</a>
          </small>
        </div>

        <div class="input-group">
          <label for="zoho-token">
            <span class="label-icon">🔐</span>
            Zoho OAuth Token
          </label>
          <input
            id="zoho-token"
            v-model="zohoToken"
            type="password"
            placeholder="1000.xxxxxxxxxxxxxxxxxxxxxxxx"
            class="input-field"
            @input="updateZohoToken"
          />
          <small class="input-hint">
            Your Zoho OAuth access token for QuickML API
          </small>
        </div>
      </section>

      <!-- Figma URLs Section -->
      <section class="urls-section card">
        <h2 class="section-title">
          <span class="step-number">2</span>
          Figma Design URLs
        </h2>

        <div class="platform-inputs">
          <div class="input-group">
            <label for="android-url">
              <span class="platform-icon">🤖</span>
              Android Design URL
            </label>
            <input
              id="android-url"
              v-model="androidUrl"
              type="url"
              placeholder="https://www.figma.com/file/..."
              class="input-field"
            />
          </div>

          <div class="input-group">
            <label for="ios-url">
              <span class="platform-icon">🍎</span>
              iOS Design URL
            </label>
            <input
              id="ios-url"
              v-model="iosUrl"
              type="url"
              placeholder="https://www.figma.com/file/..."
              class="input-field"
            />
          </div>

          <div class="input-group">
            <label for="web-url">
              <span class="platform-icon">🌐</span>
              Web Design URL
            </label>
            <input
              id="web-url"
              v-model="webUrl"
              type="url"
              placeholder="https://www.figma.com/file/..."
              class="input-field"
            />
          </div>
        </div>
      </section>

      <!-- Action Button -->
      <section class="action-section">
        <button
          @click="analyzeDesigns"
          :disabled="isAnalyzing || !canAnalyze"
          class="analyze-button"
        >
          <span v-if="!isAnalyzing" class="button-content">
            <span class="button-icon">🚀</span>
            Analyze & Map Components
          </span>
          <span v-else class="button-content">
            <span class="spinner"></span>
            {{ analysisStatus }}
          </span>
        </button>
      </section>

      <!-- Progress Section -->
      <section v-if="isAnalyzing" class="progress-section card">
        <h3 class="progress-title">Analysis Progress</h3>
        <div class="progress-steps">
          <div
            v-for="step in progressSteps"
            :key="step.id"
            class="progress-step"
            :class="{ active: step.active, completed: step.completed }"
          >
            <div class="step-icon">
              <span v-if="step.completed">✓</span>
              <span v-else-if="step.active" class="spinner-small"></span>
              <span v-else>{{ step.number }}</span>
            </div>
            <div class="step-label">{{ step.label }}</div>
          </div>
        </div>
      </section>

      <!-- Results Section -->
      <section v-if="results" class="results-section">
        <!-- Summary Card -->
        <div class="card summary-card">
          <h2 class="section-title">
            <span class="icon">📊</span>
            Analysis Summary
          </h2>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-value">{{ results.mapping?.mappings?.length || 0 }}</div>
              <div class="summary-label">Component Mappings</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">{{ results.mapping?.summary?.consistent_components || 0 }}</div>
              <div class="summary-label">Consistent Components</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">{{ results.mapping?.summary?.inconsistencies?.length || 0 }}</div>
              <div class="summary-label">Inconsistencies</div>
            </div>
          </div>
          
          <!-- PDF Export Button -->
          <div class="export-actions">
            <button @click="exportToPDF" class="btn-export">
              <span class="icon">📄</span>
              Download PDF Report
            </button>
          </div>
        </div>

        <!-- Text Format Component Mappings (Human Readable) -->
        <div v-if="results.mapping?.text || results.mapping?.buttons" class="card text-mappings-card">
          <h2 class="section-title">
            <span class="icon">📝</span>
            Component Analysis Report
          </h2>
          
          <!-- Text Components -->
          <div v-if="results.mapping?.text?.length > 0" class="component-section">
            <h3 class="component-type-title">Text Components ({{ results.mapping.text.length }})</h3>
            <div class="text-component-list">
              <div 
                v-for="(item, index) in results.mapping.text" 
                :key="'text-' + index"
                class="text-component-item"
              >
                <span class="component-icon">{{ item.icon }}</span>
                <span class="component-text">
                  <strong>{{ item.name }}</strong> - {{ item.platforms }}
                </span>
                <span v-if="item.llmEnhanced" class="llm-badge" title="LLM Enhanced Mapping">🤖 AI</span>
              </div>
            </div>
          </div>

          <!-- Button Components -->
          <div v-if="results.mapping?.buttons?.length > 0" class="component-section">
            <h3 class="component-type-title">Button Components ({{ results.mapping.buttons.length }})</h3>
            <div class="text-component-list">
              <div 
                v-for="(item, index) in results.mapping.buttons" 
                :key="'button-' + index"
                class="text-component-item"
              >
                <span class="component-icon">{{ item.icon }}</span>
                <span class="component-text">
                  <strong>{{ item.name }}</strong> - {{ item.platforms }}
                </span>
                <span v-if="item.llmEnhanced" class="llm-badge" title="LLM Enhanced Mapping">🤖 AI</span>
              </div>
            </div>
          </div>

          <!-- Summary Stats -->
          <div class="mapping-summary">
            <div class="summary-stat">
              <span class="stat-icon">✅</span>
              <span class="stat-text">{{ results.consistent }} components consistent across all platforms</span>
            </div>
            <div class="summary-stat">
              <span class="stat-icon">⚠️</span>
              <span class="stat-text">{{ results.inconsistent }} components with platform differences</span>
            </div>
          </div>
        </div>

        <!-- Component Mappings -->
        <div class="card mappings-card">
          <h2 class="section-title">
            <span class="icon">🔗</span>
            Component Mappings
          </h2>
          
          <div v-if="results.mapping?.mappings?.length > 0" class="mappings-list">
            <div
              v-for="(mapping, index) in results.mapping.mappings"
              :key="index"
              class="mapping-item"
              :class="{ consistent: mapping.consistency === 'equivalent' }"
            >
              <div class="mapping-header">
                <h3 class="mapping-purpose">{{ formatPurpose(mapping.purpose) }}</h3>
                <span class="consistency-badge" :class="mapping.consistency">
                  {{ mapping.consistency }}
                </span>
              </div>

              <div class="mapping-platforms">
                <div class="platform-mapping">
                  <div class="platform-label">
                    <span class="platform-icon">🤖</span>
                    Android
                  </div>
                  <div class="component-info">
                    <div class="component-type">{{ mapping.android?.type || 'missing' }}</div>
                    <div class="component-name">{{ mapping.android?.name || '-' }}</div>
                    <div class="component-impl">{{ mapping.android?.implementation || '-' }}</div>
                  </div>
                </div>

                <div class="mapping-arrow">⟷</div>

                <div class="platform-mapping">
                  <div class="platform-label">
                    <span class="platform-icon">🍎</span>
                    iOS
                  </div>
                  <div class="component-info">
                    <div class="component-type">{{ mapping.ios?.type || 'missing' }}</div>
                    <div class="component-name">{{ mapping.ios?.name || '-' }}</div>
                    <div class="component-impl">{{ mapping.ios?.implementation || '-' }}</div>
                  </div>
                </div>

                <div class="mapping-arrow">⟷</div>

                <div class="platform-mapping">
                  <div class="platform-label">
                    <span class="platform-icon">🌐</span>
                    Web
                  </div>
                  <div class="component-info">
                    <div class="component-type">{{ mapping.web?.type || 'missing' }}</div>
                    <div class="component-name">{{ mapping.web?.name || '-' }}</div>
                    <div class="component-impl">{{ mapping.web?.implementation || '-' }}</div>
                  </div>
                </div>
              </div>

              <div v-if="mapping.notes" class="mapping-notes">
                <strong>Notes:</strong> {{ mapping.notes }}
              </div>
            </div>
          </div>

          <div v-else class="no-mappings">
            <p>No component mappings found. The LLM may not have identified equivalent components.</p>
          </div>
        </div>

        <!-- Platform Details -->
        <div class="platforms-grid">
          <div class="card platform-card">
            <h3 class="platform-title">
              <span class="platform-icon">🤖</span>
              Android Components
            </h3>
            <div class="components-list">
              <div
                v-for="(comp, idx) in results.platforms?.android?.components"
                :key="idx"
                class="component-item"
              >
                <div class="component-type-badge">{{ comp.type }}</div>
                <div class="component-details">
                  <div class="component-name">{{ comp.name || comp.text }}</div>
                  <div class="component-purpose">{{ comp.purpose }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="card platform-card">
            <h3 class="platform-title">
              <span class="platform-icon">🍎</span>
              iOS Components
            </h3>
            <div class="components-list">
              <div
                v-for="(comp, idx) in results.platforms?.ios?.components"
                :key="idx"
                class="component-item"
              >
                <div class="component-type-badge">{{ comp.type }}</div>
                <div class="component-details">
                  <div class="component-name">{{ comp.name || comp.text }}</div>
                  <div class="component-purpose">{{ comp.purpose }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="card platform-card">
            <h3 class="platform-title">
              <span class="platform-icon">🌐</span>
              Web Components
            </h3>
            <div class="components-list">
              <div
                v-for="(comp, idx) in results.platforms?.web?.components"
                :key="idx"
                class="component-item"
              >
                <div class="component-type-badge">{{ comp.type }}</div>
                <div class="component-details">
                  <div class="component-name">{{ comp.name || comp.text }}</div>
                  <div class="component-purpose">{{ comp.purpose }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Raw Response (Debug) -->
        <details class="card debug-section">
          <summary class="debug-title">🔍 Raw LLM Response (Debug)</summary>
          <pre class="debug-content">{{ JSON.stringify(results, null, 2) }}</pre>
        </details>
      </section>

      <!-- Error Display -->
      <div v-if="error" class="error-card card">
        <h3 class="error-title">❌ Error</h3>
        <p class="error-message">{{ error }}</p>
      </div>
    </main>

    <footer class="app-footer">
      <p>Built with Vue.js + Zoho Catalyst QuickML</p>
    </footer>
  </div>
</template>

<script>
import { analyzeAndMapPlatforms } from './utils/quickMLLLMApi.js'
import { analyzeWithHybridApproach } from './utils/hybridAnalyzer.js'
import { startAutoRefresh, getTokenInfo } from './utils/tokenManager.js'

export default {
  name: 'AppWithLLM',
  data() {
    return {
      figmaToken: '',
      zohoToken: localStorage.getItem('zoho_oauth_token') || '',
      androidUrl: '',
      iosUrl: '',
      webUrl: '',
      isAnalyzing: false,
      analysisStatus: 'Analyzing...',
      results: null,
      error: null,
      useHybridApproach: true, // Use hybrid by default (faster, smaller payload)
      progressSteps: [
        { id: 1, number: 1, label: 'Fetching Figma Designs', active: false, completed: false },
        { id: 2, number: 2, label: 'Analyzing Android Components', active: false, completed: false },
        { id: 3, number: 3, label: 'Analyzing iOS Components', active: false, completed: false },
        { id: 4, number: 4, label: 'Analyzing Web Components', active: false, completed: false },
        { id: 5, number: 5, label: 'Mapping Components', active: false, completed: false }
      ]
    }
  },
  mounted() {
    // Start automatic token refresh for Zoho OAuth
    console.log('🚀 Initializing PixelCheck AI...')
    startAutoRefresh()
    console.log('✅ Automatic token refresh started')
    
    // Log token status
    const tokenInfo = getTokenInfo()
    console.log('🔑 Token status:', tokenInfo)
  },
  computed: {
    canAnalyze() {
      return this.figmaToken && this.androidUrl && this.iosUrl && this.webUrl
    }
  },
  methods: {
    async analyzeDesigns() {
      this.isAnalyzing = true
      this.error = null
      this.results = null
      this.resetProgress()

      try {
        // Step 1: Fetch designs
        this.updateProgress(0, true)
        this.analysisStatus = 'Fetching Figma designs...'
        
        // Import fetchFigmaJSON to get the raw JSON
        const { fetchFigmaJSON, extractFigmaFileKey } = await import('./utils/quickMLLLMApi.js')
        
        const androidKey = extractFigmaFileKey(this.androidUrl)
        const iosKey = extractFigmaFileKey(this.iosUrl)
        const webKey = extractFigmaFileKey(this.webUrl)
        
        const androidJson = await fetchFigmaJSON(androidKey, this.figmaToken)
        await this.delay(10000) // Figma rate limit
        const iosJson = await fetchFigmaJSON(iosKey, this.figmaToken)
        await this.delay(10000) // Figma rate limit
        const webJson = await fetchFigmaJSON(webKey, this.figmaToken)
        
        this.updateProgress(0, false, true)

        // Step 2-5: Analyze with hybrid approach
        this.updateProgress(1, true)
        this.analysisStatus = this.useHybridApproach ? 
          'Analyzing with Hybrid Approach (Traditional + LLM)...' :
          'Analyzing with QuickML LLM...'
        
        let results
        if (this.useHybridApproach) {
          // Use hybrid: Traditional extraction + LLM mapping
          results = await analyzeWithHybridApproach(
            androidJson,
            iosJson,
            webJson,
            this.zohoToken
          )
        } else {
          // Use full LLM approach
          results = await analyzeAndMapPlatforms(
            this.androidUrl,
            this.iosUrl,
            this.webUrl,
            this.figmaToken
          )
        }

        this.updateProgress(1, false, true)
        this.updateProgress(2, false, true)
        this.updateProgress(3, false, true)
        this.updateProgress(4, false, true)

        this.results = results
        this.analysisStatus = 'Complete!'
      } catch (err) {
        console.error('Analysis error:', err)
        this.error = err.message || 'An error occurred during analysis'
      } finally {
        this.isAnalyzing = false
      }
    },
    updateProgress(stepIndex, active, completed = false) {
      this.progressSteps[stepIndex].active = active
      if (completed) {
        this.progressSteps[stepIndex].completed = true
        this.progressSteps[stepIndex].active = false
      }
    },
    resetProgress() {
      this.progressSteps.forEach(step => {
        step.active = false
        step.completed = false
      })
    },
    formatPurpose(purpose) {
      return purpose.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    },
    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms))
    },
    exportToPDF() {
      if (!this.results) return
      
      // Create PDF content
      const content = this.generatePDFContent()
      
      // Create a printable HTML page
      const printWindow = window.open('', '_blank')
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>PixelCheck Component Analysis Report</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              max-width: 800px;
              margin: 40px auto;
              padding: 20px;
              color: #333;
            }
            h1 {
              color: #6366f1;
              border-bottom: 3px solid #6366f1;
              padding-bottom: 10px;
            }
            h2 {
              color: #4f46e5;
              margin-top: 30px;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 8px;
            }
            h3 {
              color: #6366f1;
              margin-top: 20px;
            }
            .summary {
              background: #f3f4f6;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              margin-top: 15px;
            }
            .summary-item {
              text-align: center;
            }
            .summary-value {
              font-size: 32px;
              font-weight: bold;
              color: #6366f1;
            }
            .summary-label {
              font-size: 14px;
              color: #6b7280;
              margin-top: 5px;
            }
            .component-item {
              padding: 12px;
              margin: 8px 0;
              border-left: 4px solid #d1d5db;
              background: #f9fafb;
            }
            .component-item.consistent {
              border-left-color: #10b981;
            }
            .component-item.inconsistent {
              border-left-color: #f59e0b;
            }
            .component-name {
              font-weight: 600;
              color: #111827;
            }
            .component-platforms {
              color: #6b7280;
              margin-left: 10px;
            }
            .llm-badge {
              background: #6366f1;
              color: white;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 11px;
              margin-left: 10px;
            }
            .report-meta {
              background: #f9fafb;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
              border-left: 4px solid #6366f1;
            }
            .report-meta p {
              margin: 5px 0;
              color: #374151;
            }
            .toc {
              background: #f3f4f6;
              padding: 20px;
              border-radius: 8px;
              margin: 30px 0;
            }
            .toc-list {
              margin: 15px 0;
              padding-left: 25px;
            }
            .toc-list li {
              margin: 10px 0;
              font-size: 16px;
            }
            .toc-list a {
              color: #4f46e5;
              text-decoration: none;
            }
            .toc-list a:hover {
              text-decoration: underline;
            }
            .subsection {
              color: #6366f1;
              font-size: 18px;
              margin-top: 25px;
              margin-bottom: 15px;
              padding-bottom: 8px;
              border-bottom: 1px solid #e5e7eb;
            }
            .recommendations {
              background: #fef3c7;
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #f59e0b;
            }
            .recommendations h3 {
              color: #92400e;
              margin-top: 15px;
            }
            .recommendations ul {
              margin: 10px 0;
              padding-left: 25px;
            }
            .recommendations li {
              margin: 8px 0;
              color: #78350f;
            }
            .page-break {
              page-break-after: always;
              margin-bottom: 40px;
            }
            .page-break-before {
              page-break-before: always;
              margin-top: 40px;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #9ca3af;
              font-size: 12px;
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
              .page-break { page-break-after: always; }
              .page-break-before { page-break-before: always; }
              h2 { page-break-after: avoid; }
              .component-item { page-break-inside: avoid; }
            }
          <\/style>
        </head>
        <body>
          ${content}
          <div class="footer">
            <p>Generated by PixelCheck AI - ${new Date().toLocaleString()}</p>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            }
          <\/script>
        <\/body>
        <\/html>
      `)
      printWindow.document.close()
    },
    generatePDFContent() {
      const r = this.results
      
      // Calculate totals
      const totalComponents = (r.mapping?.text?.length || 0) + (r.mapping?.buttons?.length || 0)
      const consistentComponents = r.mapping?.text?.filter(item => item.icon === '✅').length || 0
      const inconsistentComponents = totalComponents - consistentComponents
      
      let html = `
        <h1>📊 PixelCheck Component Analysis Report</h1>
        <div class="report-meta">
          <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Total Components Analyzed:</strong> ${totalComponents}</p>
          <p><strong>Analysis Method:</strong> ${r.method === 'hybrid' ? 'Hybrid (Traditional + AI)' : 'Traditional'}</p>
        </div>
        
        <!-- Table of Contents -->
        <div class="toc page-break">
          <h2>📑 Table of Contents</h2>
          <ol class="toc-list">
            <li><a href="#summary">Analysis Summary</a></li>
            ${r.mapping?.text?.length > 0 ? `<li><a href="#text-components">Text Components (${r.mapping.text.length})</a></li>` : ''}
            ${r.mapping?.buttons?.length > 0 ? `<li><a href="#button-components">Button Components (${r.mapping.buttons.length})</a></li>` : ''}
            <li><a href="#inconsistencies">Inconsistencies & Recommendations</a></li>
          </ol>
        </div>
        
        <!-- Summary Section -->
        <div id="summary" class="summary page-break">
          <h2>📊 Analysis Summary</h2>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-value">${r.android?.total || 0}</div>
              <div class="summary-label">Android Components</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${r.ios?.total || 0}</div>
              <div class="summary-label">iOS Components</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${r.web?.total || 0}</div>
              <div class="summary-label">Web Components</div>
            </div>
          </div>
          <div class="summary-grid" style="margin-top: 20px;">
            <div class="summary-item">
              <div class="summary-value">${r.consistent || 0}</div>
              <div class="summary-label">✅ Consistent</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${r.inconsistent || 0}</div>
              <div class="summary-label">⚠️ Inconsistent</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${totalComponents}</div>
              <div class="summary-label">Total Mappings</div>
            </div>
          </div>
        </div>
      `
      
      // Text Components with pagination
      if (r.mapping?.text?.length > 0) {
        html += `<div id="text-components" class="page-break"><h2>📝 Text Components (${r.mapping.text.length})</h2>`
        
        // Group by consistency for better organization
        const consistentText = r.mapping.text.filter(item => item.icon === '✅')
        const inconsistentText = r.mapping.text.filter(item => item.icon !== '✅')
        
        if (consistentText.length > 0) {
          html += `<h3 class="subsection">✅ Consistent Across All Platforms (${consistentText.length})</h3>`
          consistentText.forEach((item, index) => {
            const llmBadge = item.llmEnhanced ? '<span class="llm-badge">🤖 AI Enhanced</span>' : ''
            // Add page break every 30 items for better pagination
            const pageBreakClass = index > 0 && index % 30 === 0 ? 'page-break-before' : ''
            html += `
              <div class="component-item consistent ${pageBreakClass}">
                <span>${item.icon}</span>
                <span class="component-name">${this.escapeHtml(item.name)}</span>
                <span class="component-platforms">- ${item.platforms}</span>
                ${llmBadge}
              </div>
            `
          })
        }
        
        if (inconsistentText.length > 0) {
          html += `<h3 class="subsection page-break-before">⚠️ Platform Differences (${inconsistentText.length})</h3>`
          inconsistentText.forEach((item, index) => {
            const llmBadge = item.llmEnhanced ? '<span class="llm-badge">🤖 AI Enhanced</span>' : ''
            const pageBreakClass = index > 0 && index % 30 === 0 ? 'page-break-before' : ''
            html += `
              <div class="component-item inconsistent ${pageBreakClass}">
                <span>${item.icon}</span>
                <span class="component-name">${this.escapeHtml(item.name)}</span>
                <span class="component-platforms">- ${item.platforms}</span>
                ${llmBadge}
              </div>
            `
          })
        }
        
        html += `</div>`
      }
      
      // Button Components with pagination
      if (r.mapping?.buttons?.length > 0) {
        html += `<div id="button-components" class="page-break"><h2>🔘 Button Components (${r.mapping.buttons.length})</h2>`
        
        const consistentButtons = r.mapping.buttons.filter(item => item.icon === '✅')
        const inconsistentButtons = r.mapping.buttons.filter(item => item.icon !== '✅')
        
        if (consistentButtons.length > 0) {
          html += `<h3 class="subsection">✅ Consistent Across All Platforms (${consistentButtons.length})</h3>`
          consistentButtons.forEach((item, index) => {
            const llmBadge = item.llmEnhanced ? '<span class="llm-badge">🤖 AI Enhanced</span>' : ''
            const pageBreakClass = index > 0 && index % 30 === 0 ? 'page-break-before' : ''
            html += `
              <div class="component-item consistent ${pageBreakClass}">
                <span>${item.icon}</span>
                <span class="component-name">${this.escapeHtml(item.name)}</span>
                <span class="component-platforms">- ${item.platforms}</span>
                ${llmBadge}
              </div>
            `
          })
        }
        
        if (inconsistentButtons.length > 0) {
          html += `<h3 class="subsection page-break-before">⚠️ Platform Differences (${inconsistentButtons.length})</h3>`
          inconsistentButtons.forEach((item, index) => {
            const llmBadge = item.llmEnhanced ? '<span class="llm-badge">🤖 AI Enhanced</span>' : ''
            const pageBreakClass = index > 0 && index % 30 === 0 ? 'page-break-before' : ''
            html += `
              <div class="component-item inconsistent ${pageBreakClass}">
                <span>${item.icon}</span>
                <span class="component-name">${this.escapeHtml(item.name)}</span>
                <span class="component-platforms">- ${item.platforms}</span>
                ${llmBadge}
              </div>
            `
          })
        }
        
        html += `</div>`
      }
      
      // Recommendations section
      if (inconsistentComponents > 0) {
        html += `
          <div id="inconsistencies" class="page-break recommendations">
            <h2>💡 Recommendations</h2>
            <p>Found <strong>${inconsistentComponents}</strong> component(s) with platform differences.</p>
            <h3>Action Items:</h3>
            <ul>
              <li>Review components marked with ⚠️ for platform consistency</li>
              <li>Ensure critical features (search, filter, navigation) are available on all platforms</li>
              <li>Consider design system alignment for better cross-platform experience</li>
              ${r.method === 'hybrid' ? '<li>Components marked with 🤖 AI were intelligently mapped - review for accuracy</li>' : ''}
            </ul>
          </div>
        `
      }
      
      return html
    },
    escapeHtml(text) {
      const div = document.createElement('div')
      div.textContent = text
      return div.innerHTML
    },
    updateZohoToken() {
      // Save to localStorage whenever user types
      localStorage.setItem('zoho_oauth_token', this.zohoToken)
      console.log('✅ Zoho token saved to localStorage')
    }
  }
}
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #2d3748;
}

.app-header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
}

.app-title {
  font-size: 2.5rem;
  font-weight: 800;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 0.5rem;
}

.icon {
  font-size: 2rem;
  margin-right: 0.5rem;
}

.app-subtitle {
  font-size: 1.25rem;
  color: #4a5568;
  margin-bottom: 0.5rem;
}

.powered-by {
  font-size: 0.875rem;
  color: #718096;
  font-weight: 500;
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.card {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.15);
}

.section-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #2d3748;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 50%;
  font-size: 1rem;
  font-weight: 700;
}

.input-group {
  margin-bottom: 1.5rem;
}

.input-group label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 0.5rem;
}

.label-icon,
.platform-icon {
  font-size: 1.25rem;
}

.input-field {
  width: 100%;
  padding: 0.875rem 1rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.3s ease;
}

.input-field:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.input-hint {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #718096;
}

.input-hint a {
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
}

.input-hint a:hover {
  text-decoration: underline;
}

.platform-inputs {
  display: grid;
  gap: 1.5rem;
}

.analyze-button {
  width: 100%;
  max-width: 400px;
  display: block;
  margin: 0 auto;
  padding: 1.25rem 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1.125rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.analyze-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
}

.analyze-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.button-icon {
  font-size: 1.5rem;
}

.spinner,
.spinner-small {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner-small {
  width: 16px;
  height: 16px;
  border-width: 2px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.progress-section {
  background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
}

.progress-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  text-align: center;
}

.progress-steps {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.progress-step {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  opacity: 0.5;
  transition: all 0.3s ease;
}

.progress-step.active {
  opacity: 1;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

.progress-step.completed {
  opacity: 1;
  background: #48bb78;
  color: white;
}

.step-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  font-weight: 700;
}

.step-label {
  font-weight: 600;
}

.summary-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
}

.summary-item {
  text-align: center;
}

.summary-value {
  font-size: 3rem;
  font-weight: 800;
  margin-bottom: 0.5rem;
}

.summary-label {
  font-size: 1rem;
  opacity: 0.9;
}

.mappings-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.mapping-item {
  padding: 1.5rem;
  background: #f7fafc;
  border-radius: 12px;
  border-left: 4px solid #e2e8f0;
  transition: all 0.3s ease;
}

.mapping-item.consistent {
  border-left-color: #48bb78;
  background: linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%);
}

.mapping-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.mapping-purpose {
  font-size: 1.25rem;
  font-weight: 700;
  color: #2d3748;
}

.consistency-badge {
  padding: 0.375rem 0.875rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
}

.consistency-badge.equivalent {
  background: #48bb78;
  color: white;
}

.consistency-badge.partial {
  background: #ed8936;
  color: white;
}

.consistency-badge.missing {
  background: #f56565;
  color: white;
}

.mapping-platforms {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr;
  gap: 1rem;
  align-items: center;
}

.platform-mapping {
  background: white;
  padding: 1rem;
  border-radius: 8px;
}

.platform-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
  color: #2d3748;
  margin-bottom: 0.75rem;
}

.component-info {
  font-size: 0.875rem;
}

.component-type {
  font-weight: 700;
  color: #667eea;
  margin-bottom: 0.25rem;
}

.component-name {
  color: #2d3748;
  margin-bottom: 0.25rem;
}

.component-impl {
  color: #718096;
  font-size: 0.8125rem;
}

.mapping-arrow {
  font-size: 1.5rem;
  color: #a0aec0;
}

.mapping-notes {
  margin-top: 1rem;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  font-size: 0.875rem;
  color: #4a5568;
}

.no-mappings {
  text-align: center;
  padding: 2rem;
  color: #718096;
}

.platforms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.platform-card {
  background: linear-gradient(135deg, #ffffff 0%, #f7fafc 100%);
}

.platform-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: #2d3748;
}

.components-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.component-item {
  display: flex;
  gap: 0.75rem;
  padding: 0.875rem;
  background: white;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.component-type-badge {
  padding: 0.25rem 0.625rem;
  background: #667eea;
  color: white;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  height: fit-content;
}

.component-details {
  flex: 1;
}

.component-name {
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 0.25rem;
}

.component-purpose {
  font-size: 0.875rem;
  color: #718096;
}

.debug-section {
  background: #1a202c;
  color: #e2e8f0;
}

.debug-title {
  font-size: 1.125rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0.5rem 0;
}

.debug-content {
  margin-top: 1rem;
  padding: 1rem;
  background: #2d3748;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.875rem;
  line-height: 1.6;
}

.error-card {
  background: linear-gradient(135deg, #fed7d7 0%, #fc8181 100%);
  border-left: 4px solid #f56565;
}

.error-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #742a2a;
  margin-bottom: 0.75rem;
}

.error-message {
  color: #742a2a;
  font-weight: 500;
}

.app-footer {
  text-align: center;
  padding: 2rem;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.875rem;
}

@media (max-width: 768px) {
  .mapping-platforms {
    grid-template-columns: 1fr;
  }

  .mapping-arrow {
    transform: rotate(90deg);
  }

  .platforms-grid {
    grid-template-columns: 1fr;
  }
}

/* Text Format Component Mappings */
.export-actions {
  margin-top: 1.5rem;
  display: flex;
  justify-content: center;
}

.btn-export {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.3s ease;
  box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);
}

.btn-export:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(102, 126, 234, 0.4);
}

.btn-export .icon {
  font-size: 1.25rem;
}

.text-mappings-card {
  margin-top: 2rem;
}

.component-section {
  margin-top: 2rem;
}

.component-type-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #4f46e5;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e5e7eb;
}

.text-component-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.text-component-item {
  display: flex;
  align-items: center;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
  border-left: 4px solid #d1d5db;
  transition: all 0.2s ease;
}

.text-component-item:hover {
  background: #f3f4f6;
  transform: translateX(4px);
}

.component-icon {
  font-size: 1.25rem;
  margin-right: 0.75rem;
}

.component-text {
  flex: 1;
  font-size: 1rem;
  color: #374151;
}

.component-text strong {
  color: #111827;
  font-weight: 600;
}

.llm-badge {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.mapping-summary {
  margin-top: 2rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border-radius: 12px;
  border-left: 4px solid #0ea5e9;
}

.summary-stat {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0;
  font-size: 1rem;
  color: #0c4a6e;
}

.stat-icon {
  font-size: 1.5rem;
}

.stat-text {
  font-weight: 500;
}
</style>
