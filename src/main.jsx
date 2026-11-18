import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles/base.css'
import App from './App.jsx'
import './lib/sound.js'
createRoot(document.getElementById('root')).render(<App />)
