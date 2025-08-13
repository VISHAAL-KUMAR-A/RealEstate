export default function Logos() {
  const list = [
    'Bloomberg',
    'Zillow',
    'Redfin',
    'Census',
    'FRED',
    'CoreLogic'
  ]
  return (
    <div className="mt-10 opacity-70">
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-xs sm:text-sm">
        {list.map((l) => (
          <div key={l} className="uppercase tracking-widest text-slate-400">
            {l}
          </div>
        ))}
      </div>
    </div>
  )
}


