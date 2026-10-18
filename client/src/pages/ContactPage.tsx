import PageHeader from "../components/PageHeader";
import Contact from "../components/Contact";

export default function ContactPage() {
  return (
    <>
      <PageHeader
        kicker="Contact"
        title="Start a project"
        subtitle="Buy a package or send a note for a custom quote. I usually reply within one business day."
      />
      <Contact />
    </>
  );
}
