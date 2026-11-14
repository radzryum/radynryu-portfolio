import { useEffect, useId, useState } from 'react'
import './ThemeToggle.css'

function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)
  const switchId = useId()

  useEffect(() => {
    if (document.documentElement.classList.contains('dark')) {
      setIsDark(true)
    }
  }, [])

  const toggleTheme = () => {
    const nextState = !isDark
    setIsDark(nextState)
    if (nextState) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center scale-[0.60] xl:scale-[0.95] origin-center" title="Toggle Theme">
      <label className="uiverse-switch" style={{ fontSize: '10px' }} htmlFor={switchId}>
        <input
          id={switchId}
          type="checkbox"
          checked={isDark}
          onChange={toggleTheme}
          aria-label="Toggle dark mode"
        />
        <span className="uiverse-slider"></span>
      </label>
    </div>
  )
}

export default ThemeToggle
