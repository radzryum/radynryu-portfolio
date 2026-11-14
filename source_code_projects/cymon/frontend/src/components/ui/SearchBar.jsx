import React from 'react'

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true" stroke="currentColor">
    <path
      d="M10 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM20 20l-4-4"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export default function SearchBar({ value, onChange, placeholder = 'Search...', className = '', onFocus, onBlur }) {
  return (
    <div className={`relative flex items-center w-full group ${className}`}>
      <input
        className="w-full h-[46px] bg-zinc-100 dark:bg-slate-800 text-zinc-700 dark:text-slate-100 ring-1 ring-zinc-300 dark:ring-slate-700 focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-500 outline-none duration-300 placeholder:text-zinc-500 dark:placeholder:text-slate-400 placeholder:opacity-70 rounded-full pl-5 pr-12 py-2.5 shadow-sm focus:shadow-md focus:shadow-purple-200 dark:focus:shadow-purple-900/20"
        autoComplete="off"
        placeholder={placeholder}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      <span
        className="absolute right-1.5 flex shrink-0 items-center justify-center bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 ring-1 ring-purple-300 dark:ring-purple-800 group-focus-within:ring-2 group-focus-within:ring-purple-400 dark:group-focus-within:ring-purple-500 group-focus-within:bg-purple-100 dark:group-focus-within:bg-purple-900/60 hover:bg-purple-200 dark:hover:bg-purple-800/50 outline-none duration-300 rounded-full p-2 shadow-sm cursor-pointer transition-all"
      >
        <SearchIcon />
      </span>
    </div>
  )
}
