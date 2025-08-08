import AppLayout from "@/components/layout/AppLayout";
import Seo from "@/components/seo/Seo";

const Catalog = () => {
  return (
    <AppLayout title="Catalog">
      <Seo title="Catalog | Employee" description="Browse laptops available to you based on company policies." />
      <section aria-labelledby="employee-catalog-heading" className="space-y-4">
        <h2 id="employee-catalog-heading" className="sr-only">Available devices</h2>
        <p className="text-muted-foreground">Explore approved options and start a financing request.</p>
        <div className="rounded-md border p-6">
          <p>Coming soon: device cards with specs and monthly estimates.</p>
        </div>
      </section>
    </AppLayout>
  );
};

export default Catalog;
