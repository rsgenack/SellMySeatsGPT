import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { User as SelectUser, Ticket } from "@shared/schema";
import AdminNav from "@/components/layout/admin-nav";
import { Mail, Users, Ticket as TicketIcon, DollarSign } from "lucide-react";

export default function AdminDashboardPage() {
  const { user } = useAuth();

  // Redirect non-admin users
  if (!user?.isAdmin) {
    return <Redirect to="/dashboard" />;
  }

  const { data: users = [] } = useQuery<SelectUser[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: tickets = [] } = useQuery<Ticket[]>({
    queryKey: ["/api/admin/tickets"],
  });

  const stats = {
    totalUsers: users.length,
    totalTickets: tickets.length,
    activeListings: tickets.filter(t => !t.sold).length,
    revenue: tickets
      .filter(t => t.sold)
      .reduce((sum, t) => sum + (t.price || 0), 0),
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <nav className="border-b px-4 py-3">
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold text-primary">SellMySeats Admin</h1>
        </div>
      </nav>

      <AdminNav />

      <main className="container mx-auto py-8 px-4 space-y-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                  <h2 className="text-3xl font-bold">{stats.totalUsers}</h2>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Tickets</p>
                  <h2 className="text-3xl font-bold">{stats.totalTickets}</h2>
                </div>
                <TicketIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Listings</p>
                  <h2 className="text-3xl font-bold">{stats.activeListings}</h2>
                </div>
                <Mail className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                  <h2 className="text-3xl font-bold">${stats.revenue.toFixed(2)}</h2>
                </div>
                <DollarSign className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Users */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Users</CardTitle>
            <CardDescription>Overview of recently registered users and their activity.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tickets Listed</TableHead>
                  <TableHead>Revenue Generated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.slice(0, 5).map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {tickets.filter(t => t.userId === user.id).length}
                    </TableCell>
                    <TableCell>
                      ${tickets
                        .filter(t => t.userId === user.id && t.sold)
                        .reduce((sum, t) => sum + (t.price || 0), 0)
                        .toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
