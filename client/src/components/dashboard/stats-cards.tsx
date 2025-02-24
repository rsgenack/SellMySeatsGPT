import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ticket, Payment } from "@shared/schema";
import {
  BarChart3,
  DollarSign,
  ShoppingCart,
  Ticket as TicketIcon,
} from "lucide-react";

interface StatsCardsProps {
  tickets: Ticket[];
  payments: Payment[];
}

export default function StatsCards({ tickets, payments }: StatsCardsProps) {
  const totalListings = tickets.length;
  const soldTickets = tickets.filter((t) => t.status === "sold").length;
  const pendingTickets = tickets.filter((t) => t.status === "pending").length;
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Listings</CardTitle>
          <TicketIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalListings}</div>
          <p className="text-xs text-muted-foreground">
            Active and sold tickets
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Sold Tickets</CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{soldTickets}</div>
          <p className="text-xs text-muted-foreground">
            Successfully sold tickets
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Sales</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{pendingTickets}</div>
          <p className="text-xs text-muted-foreground">
            Awaiting buyer purchase
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${(totalRevenue / 100).toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground">
            From completed sales
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
