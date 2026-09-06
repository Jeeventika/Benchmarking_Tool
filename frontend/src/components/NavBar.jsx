import { Link } from 'react-router-dom'

export default function NavBar() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="font-semibold text-slate-800">
          Decision Support Tool
        </Link>
        <nav className="hidden sm:flex items-center gap-6 text-sm text-slate-600">
          <Link to="/" className="hover:text-slate-900">Home</Link>
          <Link to="/compare" className="hover:text-slate-900">New Comparison</Link>
          <Link to="/" className="hover:text-slate-900">My Comparisons</Link>
          <Link to="/" className="hover:text-slate-900">About</Link>
        </nav>
        <Link
          to="/compare"
          className="rounded-full bg-slate-800 text-white text-sm px-4 py-2 hover:bg-slate-700"
        >
          + New Comparison
        </Link>
      </div>
    </header>
  )
}
