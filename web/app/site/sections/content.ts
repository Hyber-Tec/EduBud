import galleries from '~/content/galleries.json'
import type { SectionContent } from './types'

// The gallery and list sections' items (scripts/capture/galleries.ts), by section id.
const content = galleries as unknown as Record<string, SectionContent>

export function contentFor(sectionId: string): SectionContent | undefined {
  return content[sectionId]
}
