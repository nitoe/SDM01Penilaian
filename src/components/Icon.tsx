/** Ikon garis ringan (tanpa dependensi). Tambah ikon baru cukup menambah entri di PATHS. */
const PATHS = {
  home: ['M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
  quran: [
    'M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z',
    'M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z',
  ],
  clipboard: [
    'M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1z',
    'M8 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2',
    'M9 12h6M9 16h4',
  ],
  settings: [
    'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1',
    'M15 4v4M9 10v4M17 16v4',
  ],
  users: [
    'M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1',
    'M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    'M21 20v-1a4 4 0 0 0-3-3.87M16 4.13a3.5 3.5 0 0 1 0 6.74',
  ],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5M21 12H9'],
  pencil: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'],
  history: ['M12 7v5l3 2', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z'],
  target: [
    'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
    'M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0z',
    'M13 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0z',
  ],
  printer: [
    'M6 9V3h12v6',
    'M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2',
    'M6 14h12v7H6z',
  ],
  book: ['M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z', 'M4 21V5M8 7h7'],
  calendar: ['M4 6h16v15H4z', 'M4 10h16M8 3v5M16 3v5'],
  bars: ['M5 21V11M12 21V4M19 21v-7'],
  bell: ['M6 8a6 6 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  key: ['M15 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0z', 'M11 13l-7 7M7 17l2 2'],
  arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  download: ['M12 3v12', 'M8 11l4 4 4-4', 'M5 19h14'],
} as const

export type IconName = keyof typeof PATHS

interface IconProps {
  name: IconName
  className?: string
}

export default function Icon({ name, className = 'h-[18px] w-[18px]' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}
