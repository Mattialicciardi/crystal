import { useState, useRef, useEffect } from 'react'

// Icona "i" cliccabile con popover di spiegazione. Chiude su clic-fuori / Esc.
export default function InfoDot({ text }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [open])
  return (
    <span className="infodot" ref={ref}>
      <button type="button" className="infodot-btn" aria-label="spiegazione"
              onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}>i</button>
      {open && <span className="infodot-pop" onClick={(e) => e.stopPropagation()}>{text}</span>}
    </span>
  )
}
