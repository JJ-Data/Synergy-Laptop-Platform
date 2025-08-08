import AppLayout from "@/components/layout/AppLayout";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import laptop1 from "@/assets/laptops/laptop1.jpg";
import laptop2 from "@/assets/laptops/laptop2.jpg";
import laptop3 from "@/assets/laptops/laptop3.jpg";

const mockLaptops = [
  { id: "1", model: "Zen X14", specs: "i7 • 16GB • 512GB", price: 420000, image: laptop1 },
  { id: "2", model: "AeroBook 13", specs: "i5 • 8GB • 256GB", price: 285000, image: laptop2 },
  { id: "3", model: "Proline 15", specs: "Ryzen 7 • 16GB • 1TB", price: 530000, image: laptop3 },
];

const AdminDashboard = () => {
  return (
    <AppLayout title="Company Admin">
      <Seo title="Company Admin | Dashboard" description="Manage catalog, policies, and financing requests." canonical="/admin" />

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Repayment Policy</CardTitle>
            <CardDescription>Control max budgets and terms</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Max Amount (₦)</Label>
                <Input defaultValue={300000} type="number" />
              </div>
              <div>
                <Label>Interest Rate (%)</Label>
                <Input defaultValue={5} type="number" />
              </div>
              <div className="sm:col-span-2">
                <Label>Allowed Durations</Label>
                <Select defaultValue="6,12,18">
                  <SelectTrigger>
                    <SelectValue placeholder="Durations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6,12,18">6, 12, 18 months</SelectItem>
                    <SelectItem value="12,24">12, 24 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="hero">Save</Button>
              <Button variant="outline">Reset</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Onboard Employees</CardTitle>
            <CardDescription>Invite or upload CSV</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Button variant="outline">Invite via Email</Button>
            <Button variant="subtle">Upload CSV</Button>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Laptop Catalog</h2>
          <Button variant="hero">Add Laptop</Button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockLaptops.map((l) => (
            <Card key={l.id} className="group overflow-hidden">
              <div className="h-44 overflow-hidden">
                <img src={l.image} alt={`${l.model} laptop image`} className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform" loading="lazy" />
              </div>
              <CardHeader>
                <CardTitle className="text-lg">{l.model}</CardTitle>
                <CardDescription>{l.specs}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="font-semibold">₦{l.price.toLocaleString()}</div>
                <Button variant="outline">Edit</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </AppLayout>
  );
};

export default AdminDashboard;
