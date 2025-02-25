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
import { Mail, RefreshCw, Circle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface EmailStatus {
  isConnected: boolean;
  lastChecked: string | null;
  recentEmails: {
    subject: string;
    from: string;
    date: string;
    status: 'processed' | 'pending' | 'error';
  }[];
}

export default function AdminEmailMonitorPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  if (!user?.isAdmin) {
    return <Redirect to="/dashboard" />;
  }

  const { data: status, isLoading } = useQuery<EmailStatus>({
    queryKey: ["/api/admin/email/status"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const startMonitoringMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/email/start-monitoring");
    },
    onSuccess: () => {
      toast({
        title: "Email Monitoring Started",
        description: "Checking for new ticket emails...",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Monitoring Failed",
        description: error.message,
        variant: "destructive",
      });
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

      <div className="container mx-auto py-8 px-4">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Email Monitoring Status</CardTitle>
            <CardDescription>
              Monitor incoming ticket emails and their processing status.
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
              <Button
                onClick={() => startMonitoringMutation.mutate()}
                disabled={startMonitoringMutation.isPending}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${startMonitoringMutation.isPending ? "animate-spin" : ""}`} />
                Check New Emails
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {status?.recentEmails?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                        No recent emails found
                      </TableCell>
                    </TableRow>
                  )}
                  {status?.recentEmails?.map((email, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{email.subject}</TableCell>
                      <TableCell>{email.from}</TableCell>
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
