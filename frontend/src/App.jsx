import { Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar'
import Home from './pages/Home'
import StartComparison from './pages/StartComparison'
import Research from './pages/Research'
import Results from './pages/Results'
import Analysis from './pages/Analysis'
import Recommendation from './pages/Recommendation'
import Decision from './pages/Decision'

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/compare" element={<StartComparison />} />
        <Route path="/research/:id" element={<Research />} />
        <Route path="/results/:id" element={<Results />} />
        <Route path="/analysis/:id" element={<Analysis />} />
        <Route path="/recommendation/:id" element={<Recommendation />} />
        <Route path="/decision/:id" element={<Decision />} />
      </Routes>
    </div>
  )
}
