import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import App from './App.tsx'
import './index.css'

const root = document.getElementById('root')
if (!root) {
  throw new Error('Root element #root is missing.')
}

const url = import.meta.env.VITE_CONVEX_URL

createRoot(root).render(
  <StrictMode>
    {url ? (
      <ConvexProvider client={new ConvexReactClient(url)}>
        <App url={url} />
      </ConvexProvider>
    ) : (
      <App url="" />
    )}
  </StrictMode>,
)
