import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import LawPage from './pages/LawPage.tsx'
import BhoomiPage from './pages/BhoomiPage.tsx'
import MuseumPage from './pages/MuseumPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/law" element={<LawPage />} />
        <Route path="/bhoomi" element={<BhoomiPage />} />
        <Route path="/museum" element={<MuseumPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
