import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";

export default function NotFoundPage() {
  return (
    <>
      <PageHeader kicker="404" title="Off the grid" subtitle="That page doesn't exist." />
      <div className="mx-auto max-w-6xl px-5 py-16">
        <Link
          to="/"
          className="btn-silver sheen inline-block rounded-sm px-6 py-3 font-display font-semibold"
        >
          Back home
        </Link>
      </div>
    </>
  );
}
