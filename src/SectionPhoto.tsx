import type { CSSProperties } from 'react'

type Props = { section: string }

const photography: Record<string, { src: string; alt: string; position?: string }> = {
  Members: { src: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=1600&q=82', alt: 'Athlete training with free weights', position: 'center 43%' },
  Coaching: { src: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1600&q=82', alt: 'Personal trainer coaching a gym member', position: 'center 42%' },
  Attendance: { src: 'https://images.unsplash.com/photo-1517963628607-235ccdd5476c?auto=format&fit=crop&w=1600&q=82', alt: 'Athlete training on cardio equipment', position: 'center 48%' },
  'Follow-ups': { src: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1600&q=82', alt: 'Athlete focused during a strength workout', position: 'center 38%' },
  Reports: { src: 'https://images.unsplash.com/photo-1534258936925-c58bed479fcb?auto=format&fit=crop&w=1600&q=82', alt: 'Strength training equipment in a gym', position: 'center 48%' },
  Staff: { src: 'https://images.unsplash.com/photo-1576678927484-cc907957088c?auto=format&fit=crop&w=1600&q=82', alt: 'Fitness professionals working in a gym', position: 'center 42%' },
}

export default function SectionPhoto({ section }: Props) {
  const photo = photography[section]
  if (!photo) return null
  return <div className="section-photo" aria-label={section + ' section photograph'}>
    <img className="section-photo-backdrop" src={photo.src} alt="" aria-hidden="true" loading="lazy" decoding="async" />
    <img className="section-photo-main" src={photo.src} alt={photo.alt} loading="lazy" decoding="async" style={{ objectPosition: photo.position } as CSSProperties} />
    <div className="section-photo-shade" aria-hidden="true" />
    <span>{section}</span>
  </div>
}
