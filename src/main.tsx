import React from 'react'
import ReactDOM from 'react-dom/client'
import ToolHub from './ToolHub'
import './index.css'
import { ThemeProvider } from './ThemeProvider'

const rootElement = document.getElementById('root')

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ThemeProvider>
        <ToolHub />
      </ThemeProvider>
    </React.StrictMode>
  )
} else {
  throw new Error("Elemento #root não encontrado no HTML.")
}
