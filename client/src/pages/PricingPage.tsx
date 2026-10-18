import PageHeader from "../components/PageHeader";
import Pricing from "../components/Pricing";

export default function PricingPage() {
  return (
    <>
      <PageHeader
        kicker="Pricing"
        title="Pick your lane"
        subtitle="Fixed-price packages you can buy right now with Stripe. Need something custom? Ask Rebel or head to contact."
      />
      <Pricing />
    </>
  );
}
