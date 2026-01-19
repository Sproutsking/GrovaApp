import React from 'react'
import ReactDOM from 'react-dom/client'
import GrovaApp from './App.jsx'  // This is our main component
import './styles/global.css'
import "@fortawesome/fontawesome-free/css/all.min.css";


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GrovaApp />
  </React.StrictMode>
)