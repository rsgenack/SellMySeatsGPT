import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import AdminNav from "@/components/layout/admin-nav";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Mail, RefreshCw, Circle, Ticket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface EmailStatus {
  isConnected: boolean;
  lastChecked: string | null;
  isMonitoring: boolean;
  authUrl?: string;
  isAuthenticated?: boolean;
  recentEmails: {
    subject: string;
    from: string;
    date: string;
    status: 'processed' | 'pending' | 'error';
    ticketInfo?: {
      eventName: string;
      eventDate: string;
      eventTime: string;
      venue: string;
      city: string;
      state: string;
      section: string;
      row: string;
      seat: string;
    };
    recipientEmail: string;
    userName: string;
  }[];
}

export default function AdminEmailMonitorPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  if (!user?.isAdmin) {
    return <Redirect to="/dashboard" />;
  }

  const { data: status, isLoading, refetch } = useQuery<EmailStatus>({
    queryKey: ["/api/admin/email/status"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const startMonitoringMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/email/start-monitoring");
      const data = await response.json();
      if (data.needsAuth) {
        window.open(data.authUrl, '_blank');
        throw new Error('Gmail authentication required');
      }
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Email Monitoring Started",
        description: "Checking for new ticket emails...",
      });
      refetch(); // Refresh the status
    },
    onError: (error: Error) => {
      if (error.message === 'Gmail authentication required') {
        toast({
          title: "Authentication Required",
          description: "Please authenticate with Gmail in the new window",
        });
      } else {
        toast({
          title: "Monitoring Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b px-4 py-3">
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold text-primary">Admin Dashboard</h1>
        </div>
      </nav>

      <AdminNav />

      <div className="container mx-auto py-8 px-4 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Email Monitoring Status</CardTitle>
            <CardDescription>
              Monitor incoming ticket transfer emails and their processing status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Circle className={`h-3 w-3 ${status?.isConnected ? "text-green-500" : "text-red-500"} fill-current`} />
                  <span className="font-medium">
                    {status?.isConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
                {status?.lastChecked && (
                  <span className="text-sm text-muted-foreground">
                    Last checked: {new Date(status.lastChecked).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                {status?.authUrl && !status?.isAuthenticated && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(status.authUrl, '_blank')}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Authenticate Gmail
                  </Button>
                )}
                <Button
                  onClick={() => startMonitoringMutation.mutate()}
                  disabled={startMonitoringMutation.isPending}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${startMonitoringMutation.isPending ? "animate-spin" : ""}`} />
                  Check New Emails
                </Button>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient (@seatxfer.com)</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Event Details</TableHead>
                    <TableHead>Ticket Info</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {status?.recentEmails?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                        No recent ticket transfer emails found
                      </TableCell>
                    </TableRow>
                  )}
                  {status?.recentEmails?.map((email, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm">{email.recipientEmail}</TableCell>
                      <TableCell className="font-medium">{email.userName}</TableCell>
                      <TableCell>
                        {email.ticketInfo ? (
                          <div>
                            <p className="font-medium">{email.ticketInfo.eventName}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(email.ticketInfo.eventDate).toLocaleDateString()}
                            </p>
                            <p className="text-sm text-muted-foreground">{email.ticketInfo.venue}</p>
                            <p className="text-sm text-muted-foreground">
                              {email.ticketInfo.city}, {email.ticketInfo.state}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Processing...</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {email.ticketInfo ? (
                          <div className="flex items-center gap-2">
                            <Ticket className="h-4 w-4 text-muted-foreground" />
                            <span>
                              Section {email.ticketInfo.section},
                              Row {email.ticketInfo.row},
                              Seat {email.ticketInfo.seat}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Pending</span>
                        )}
                      </TableCell>
                      <TableCell>{new Date(email.date).toLocaleString()}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          email.status === 'processed' ? 'bg-green-50 text-green-700' :
                            email.status === 'pending' ? 'bg-yellow-50 text-yellow-700' :
                              'bg-red-50 text-red-700'
                        }`}>
                          {email.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}