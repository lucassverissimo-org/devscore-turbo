import { defineConfig, loadEnv } from 'vite'
import { jiraLocalApi } from './scripts/jira-local-api'

export default defineConfig(({ mode }) => ({
  plugins: [
    jiraLocalApi({ ...loadEnv(mode, process.cwd(), ''), ...process.env }),
  ],
}))
