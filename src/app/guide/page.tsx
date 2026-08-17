import type { Metadata } from 'next'
import GuideContent from './GuideContent'

export const metadata: Metadata = {
  title: 'Publishing Day — Viola House',
  description:
    "A step-by-step walkthrough for putting a finished Viola House book up for sale on Amazon.",
}

export default function GuidePage() {
  return <GuideContent />
}
