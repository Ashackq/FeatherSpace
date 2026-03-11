import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="panel-surface not-found">
      <span className="eyebrow">404</span>
      <h2>The page scaffold exists, but this route does not.</h2>
      <p>Return to the overview and continue building the workspace shell from there.</p>
      <Link to="/" className="button button-primary">
        Back to overview
      </Link>
    </section>
  );
}
