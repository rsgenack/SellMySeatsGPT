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
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { Link } from "wouter";
import { LogOut, Mail, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DashboardPage() {
  const { user, logoutMutation } = useAuth();
  const { data: tickets = [] } = useQuery<Ticket[]>({ 
    queryKey: ["/api/tickets", user?.id],
    enabled: !!user
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
      <OnboardingTour />
      <nav className="bg-white shadow-md border-b">
        <div className="container mx-auto flex justify-between items-center px-4 py-3">
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

      {user?.isAdmin && (
        <div className="bg-muted">
          <div className="container mx-auto py-2">
            <AdminNav />
          </div>
        </div>
      )}

      <main className="container mx-auto py-8 px-4 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Your Ticket Submission Email</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-lg email-submission">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <code className="bg-muted px-4 py-2 rounded-md flex-1 font-mono text-sm">
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
            <p className="mt-4 text-sm text-muted-foreground">
              Send your Ticketmaster ticket transfer emails to this address. We'll automatically process them and add them to your pending tickets.
            </p>
          </CardContent>
        </Card>

        <div className="stats-section">
          <StatsCards tickets={tickets} payments={payments} />
        </div>

        <Tabs defaultValue="listings" className="space-y-4">
          <TabsList className="w-full">
            <TabsTrigger value="listings" className="listings-tab flex-1">
              My Listings
            </TabsTrigger>
            <TabsTrigger value="pending" className="pending-tab flex-1">
              Pending Tickets
            </TabsTrigger>
            <TabsTrigger value="new" className="new-listing-tab flex-1">
              New Listing
            </TabsTrigger>
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

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Pending Tickets</CardTitle>
              </CardHeader>
              <CardContent>
                <PendingTicketList />
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