/**
 * Home page: simple welcome screen. Navigation lives in the header.
 */

type Props = {
  content: string
}

export default function HomePage({ content }: Props) {
  if (content !== 'landing') return null

  return (
    <div className="content-card">
      <div className="magnetic-no-model">
        <h3>Welcome to GravTet</h3>
      </div>
    </div>
  )
}
