import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import SmartCampus from './SmartCampus.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SmartCampus />
  </StrictMode>,
)
