import PageHeader from "../components/PageHeader";
import Work from "../components/Work";

export default function WorkPage() {
  return (
    <>
      <PageHeader
        kicker="Selected work"
        title="Proof over promises"
        subtitle="A sample of projects across web, brand, photo, and AI."
      />
      <Work />
    </>
  );
}
