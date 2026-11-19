/** The "page not found" page (Firebase Hosting serves it for any unknown address). */
export function meta() {
  return [{ title: 'EduBud International' }, { name: 'robots', content: 'noindex, nofollow' }]
}

export default function NotFound() {
  return (
    <section className="page-section not-found" data-theme="white">
      <div className="content-wrapper">
        <div className="content not-found-content">
          <h1>Page Not Found</h1>
          <p>
            We couldn&rsquo;t find the page you were looking for. This is either because:
          </p>
          <ul>
            <li>There is an error in the URL entered into your web browser. Please check the URL and try again.</li>
            <li>The page you are looking for has been moved or deleted.</li>
          </ul>
          <p>
            You can return to our homepage by <a href="/">clicking here</a>, or you can try searching for the content you are seeking by{' '}
            <a href="/search">clicking here</a>.
          </p>
        </div>
      </div>
    </section>
  )
}
