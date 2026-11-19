/**
 * What the header's drop-downs show for each page besides its name: a line taken from the page's own text, and one of
 * its pictures (a folder in web/public/media). Ours, not the original's: the owner asked for better drop-downs
 * (2026-11-19). EduBud may reword the lines; a page missing here shows its name alone.
 */
export const MENU_PAGES: Record<string, { line: string; picture: string }> = {
  '/day-learning-program': { line: 'A welcoming space to learn, connect and grow', picture: '/media/71b16a25b515' },
  '/summer-program': { line: 'Camp Bud & Bloom: a summer of learning and friendship', picture: '/media/41868636faa1' },
  '/community-chapters': { line: 'Bring EduBud to your school community', picture: '/media/e37ebafe2247' },
  '/golden-bridge-project': { line: 'Connecting student volunteers with adults with disabilities', picture: '/media/978da9aa407e' },
  '/blue-bridge-project': { line: 'Chapter leaders paired with Community Center students', picture: '/media/5dd5755919c3' },
  '/california-schools-fire-relief-project': { line: 'Support for schools hit by the wildfires', picture: '/media/53e2753194e6' },
  '/voices-of-the-vulnerable': { line: 'A service project in Spain with Soñar Despierto', picture: '/media/543635360ec3' },
  '/mentors-corner': { line: 'Notes and resources from our volunteer mentors', picture: '/media/6654c5b706a9' },
  '/our-team': { line: 'Who we are, and what we stand for', picture: '/media/dbfd070a801b' },
  '/resources': { line: 'Help for students and families', picture: '/media/da7ae9b0c549' },
  '/support-us': { line: 'Give your time, skills or support', picture: '/media/e91067b61f8e' },
}

/** Where the header's "Log In" button goes. */
export const LOGIN_HREF = '/login'
