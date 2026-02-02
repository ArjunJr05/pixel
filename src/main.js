import { createApp } from 'vue'
import AppWithLLM from './AppWithLLM.vue'

// Using hybrid approach: Traditional extraction + LLM mapping
createApp(AppWithLLM).mount('#app')
