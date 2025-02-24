import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Ticket, Payment, PendingTicket } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TicketForm from "@/components/tickets/ticket-form";
import TicketList from "@/components/tickets/ticket-list";
import PendingTicketList from "@/components/tickets/pending-ticket-list";
import StatsCards from "@/components/dashboard/stats-cards";
import { Link } from "wouter";
import { LogOut, Mail, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DashboardPage() {
  const { user, logoutMutation } = useAuth();
  const { data: tickets = [] } = useQuery<Ticket[]>({ queryKey: ["/api/tickets"] });
  const { data: payments = [] } = useQuery<Payment[]>({ queryKey: ["/api/payments"] });
  const { data: pendingTickets = [] } = useQuery<PendingTicket[]>({ 
    queryKey: ["/api/pending-tickets"],
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

      <main className="container mx-auto py-8 px-4">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Your Ticket Submission Email</CardTitle>
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

        {pendingTickets.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Pending Tickets from Email</CardTitle>
            </CardHeader>
            <CardContent>
              <PendingTicketList tickets={pendingTickets} />
            </CardContent>
          </Card>
        )}

        <StatsCards tickets={tickets} payments={payments} />

        <Tabs defaultValue="listings" className="mt-8">
          <TabsList>
            <TabsTrigger value="listings">My Listings</TabsTrigger>
            <TabsTrigger value="new">New Listing</TabsTrigger>
          </TabsList>

          <TabsContent value="listings">
            <Card>
              <CardHeader>
                <CardTitle>My Tickets</CardTitle>
              </CardHeader>
              <CardContent>
                <TicketList tickets={tickets} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="new">
            <Card>
              <CardHeader>
                <CardTitle>Create New Listing</CardTitle>
              </CardHeader>
              <CardContent>
                <TicketForm />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}