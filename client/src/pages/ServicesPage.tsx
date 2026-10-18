import PageHeader from "../components/PageHeader";
import Services from "../components/Services";

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        kicker="What I do"
        title="Services built to perform"
        subtitle="Full-stack web development, UX/UI, photo retouching, logo design, and custom AI apps."
      />
      <Services />
    </>
  );
}
