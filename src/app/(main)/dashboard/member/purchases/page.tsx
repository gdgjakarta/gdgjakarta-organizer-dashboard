import Link from "next/link";

import { ArrowLeft, ShoppingBag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function MemberPurchasesPage() {
  return (
    <div className="flex h-full flex-col p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="gap-2 text-muted-foreground hover:text-foreground">
          <Link href="/dashboard/member">
            <ArrowLeft className="size-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <Card className="max-w-md border-dashed text-center shadow-none">
          <CardHeader className="space-y-3 pb-4">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShoppingBag className="size-7" />
            </div>
            <div className="flex justify-center">
              <Badge variant="outline" className="border-muted-foreground text-muted-foreground">
                Coming Soon
              </Badge>
            </div>
            <CardTitle className="text-xl">My Purchases & Orders</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Paid event tickets, workshop passes, and GDG Jakarta merchandise order payment management will be
              available here soon.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/member">Explore Upcoming Events</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
