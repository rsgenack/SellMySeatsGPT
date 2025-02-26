import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Ticket, Payment } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TicketForm from "@/components/tickets/ticket-form";
import TicketList from "@/components/tickets/ticket-list";
import PendingTicketList from "@/components/tickets/pending-ticket-list";
import StatsCards from "@/components/dashboard/stats-cards";
import AdminNav from "@/components/layout/admin-nav";
import { Link } from "wouter";
import { LogOut, Mail, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DashboardPage() {
  const { user, logoutMutation } = useAuth();
  const { data: tickets = [] } = useQuery<Ticket[]>({ 
    queryKey: ["/api/tickets", user?.id],
    enabled: !!user // Only fetch when user is logged in
  });
  const { data: payments = [] } = useQuery<Payment[]>({ 
    queryKey: ["/api/payments", user?.id],
    enabled: !!user
  });
  const { toast } = useToast();

  const handleCopyEmail = () => {
    if (user?.uniqueEmail) {
      navigator.clipboard.writeText(user.uniqueEmail);
      toast({
        title: "Email Copied",
        description: "The email address has been copied to your clipboard.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b px-4 py-3">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/">
            <h1 className="text-2xl font-bold text-primary cursor-pointer">
              SellMySeats
            </h1>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">
              Welcome, {user?.username}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </nav>

      {user?.isAdmin && <AdminNav />}

      <main className="container mx-auto py-8 px-4">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Your Ticket Submission Email Address</CardTitle> {/* More descriptive header */}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5" />
              <code className="bg-muted px-2 py-1 rounded flex-1">
                {user?.uniqueEmail}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyEmail}
                className="ml-2"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Send your tickets to this email address. We'll process them and list them for sale.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-8"> {/* Added a card for better sectioning */}
          <CardHeader>
            <CardTitle>Dashboard Statistics</CardTitle> {/* More descriptive header */}
          </CardHeader>
          <CardContent>
            <StatsCards tickets={tickets} payments={payments} />
          </CardContent>
        </Card>

        <Card className="mb-8"> {/* Added a card for better sectioning */}
          <CardHeader>
            <CardTitle>Ticket Management</CardTitle> {/* More descriptive header */}
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="listings" className="mt-8">
              <TabsList>
                <TabsTrigger value="listings">My Tickets</TabsTrigger> {/* More descriptive label */}
                <TabsTrigger value="pending">Pending Tickets</TabsTrigger>
                <TabsTrigger value="new">Create New Listing</TabsTrigger> {/* More descriptive label */}
              </TabsList>

              <TabsContent value="listings">
                <Card>
                  <CardHeader>
                    <CardTitle>My Listed Tickets</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TicketList tickets={tickets} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="pending">
                <Card>
                  <CardHeader>
                    <CardTitle>Pending Ticket Approvals</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PendingTicketList />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="new">
                <Card>
                  <CardHeader>
                    <CardTitle>Create a New Ticket Listing</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TicketForm />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}