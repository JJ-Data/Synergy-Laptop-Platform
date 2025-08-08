import AppLayout from "@/components/layout/AppLayout";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import laptop1 from "@/assets/laptops/laptop1.jpg";
import laptop2 from "@/assets/laptops/laptop2.jpg";
import laptop3 from "@/assets/laptops/laptop3.jpg";
import { useMemo, useState } from "react";

const mockLaptops = [
  { id: "1", model: "Zen X14", specs: "i7 • 16GB • 512GB", price: 300000, image: laptop1 },
  { id: "2", model: "AeroBook 13", specs: "i5 • 8GB • 256GB", price: 250000, image: laptop2 },
  { id: "3", model: "Proline 15", specs: "Ryzen 7 • 16GB • 1TB", price: 450000, image: laptop3 },
];

const interestRate = 5; // % per year (demo)

function computeMonthly(price: number, months: number) {
  const monthlyRate = interestRate / 100 / 12;
  const payment = monthlyRate === 0 ? price / months : (price * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
  return Math.round(payment);
}

const EmployeePortal = () => {
  const [selected, setSelected] = useState(mockLaptops[0]);
  const [months, setMonths] = useState(12);
  const monthly = useMemo(() => computeMonthly(selected.price, months), [selected, months]);

  return (
    <AppLayout title="Employee Portal">
      <Seo title="Employee | Portal" description="Choose a laptop and repayment plan, track your status." canonical="/employee" />

      <section className="grid lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Available Laptops</CardTitle>
            <CardDescription>Company-specific catalog</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            {mockLaptops.map((l) => (
              <button
                key={l.id}
                onClick={() => setSelected(l)}
                className={`text-left rounded-md border p-3 transition-all hover:shadow ${
                  selected.id === l.id ? "ring-2 ring-brand" : ""
                }`}
              >
                <div className="h-28 overflow-hidden rounded">
                  <img src={l.image} alt={`${l.model} laptop image`} className="h-full w-full object-cover" loading="lazy" />
                </div>
                <div className="mt-3 font-medium">{l.model}</div>
                <div className="text-sm text-muted-foreground">{l.specs}</div>
                <div className="mt-1 text-sm font-semibold">₦{l.price.toLocaleString()}</div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Repayment Plan</CardTitle>
            <CardDescription>Preview your monthly payment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Selected</div>
                <div className="font-semibold">{selected.model}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Price</div>
                <div className="font-semibold">₦{selected.price.toLocaleString()}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="mb-2 text-sm text-muted-foreground">Duration</div>
                <Select defaultValue={months.toString()} onValueChange={(v) => setMonths(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[6, 12, 18].map((m) => (
                      <SelectItem key={m} value={m.toString()}>
                        {m} months
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-6 rounded-md border p-4 bg-secondary/30">
              <div className="text-sm text-muted-foreground">Estimated monthly payment</div>
              <div className="text-3xl font-semibold mt-1">₦{monthly.toLocaleString()}</div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="hero">Request Financing</Button>
              <Button variant="outline">View Terms</Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4">Current Financing</h2>
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
            <CardDescription>Track your balance and history</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Outstanding</div>
              <div className="font-semibold">₦120,000</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Next Deduction</div>
              <div className="font-semibold">25th — ₦25,000</div>
            </div>
            <div className="flex items-end justify-end">
              <Button variant="subtle">Download Schedule</Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </AppLayout>
  );
};

export default EmployeePortal;
