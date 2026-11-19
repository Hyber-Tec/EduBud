/** The "page not found" page (Firebase Hosting serves it for any unknown address), as the original's: no heading. */
export function meta() {
  return [{ title: 'EduBud International' }, { name: 'robots', content: 'noindex, nofollow' }]
}

export default function NotFound() {
  return (
    <div className="system-page">
      <p>We couldn't find the page you were looking for. This is either because:</p>
      <ul>
        <li>There is an error in the URL entered into your web browser. Please check the URL and try again.</li>
        <li>The page you are looking for has been moved or deleted.</li>
      </ul>
      <p>
        You can return to our homepage by <a href="/">clicking here</a>, or you can try searching for the content you are seeking by{' '}
        <a href="/search">clicking here</a>.
      </p>
    </div>
  )
}
