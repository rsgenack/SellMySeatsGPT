import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";
import { Ticket, Payment } from "@shared/schema";

interface AnalyticsDashboardProps {
  tickets: Ticket[];
  payments: Payment[];
}

export function AnalyticsDashboard({ tickets, payments }: AnalyticsDashboardProps) {
  // Process data for charts
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split('T')[0];
  }).reverse();

  const salesData = last7Days.map(date => {
    const dayTickets = tickets.filter(t => 
      t.sold && new Date(t.updatedAt).toISOString().split('T')[0] === date
    );
    
    return {
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      sales: dayTickets.length,
      revenue: dayTickets.reduce((sum, t) => sum + (t.price || 0), 0),
    };
  });

  const categoryData = tickets.reduce((acc, ticket) => {
    const category = ticket.category || 'Uncategorized';
    const existing = acc.find(item => item.category === category);
    if (existing) {
      existing.count++;
      if (ticket.sold) existing.soldCount++;
    } else {
      acc.push({ 
        category, 
        count: 1, 
        soldCount: ticket.sold ? 1 : 0 
      });
    }
    return acc;
  }, [] as { category: string; count: number; soldCount: number }[]);

  return (
    <div className="space-y-8">
      {/* Sales Trend */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Sales Trend (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="sales"
                stroke="hsl(var(--primary))"
                name="Tickets Sold"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--destructive))"
                name="Revenue ($)"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category Distribution */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Ticket Categories</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="hsl(var(--primary))" name="Total Tickets" />
              <Bar dataKey="soldCount" fill="hsl(var(--destructive))" name="Sold Tickets" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
