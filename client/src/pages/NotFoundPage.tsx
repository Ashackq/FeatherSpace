import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="panel-surface not-found">
      <span className="eyebrow">404</span>
      <h2>This route is not available.</h2>
      <p>Return to the overview to continue in FeatherSpace.</p>
      <Link to="/" className="button button-primary">
        Back to overview
      </Link>
    </section>
  );
}
