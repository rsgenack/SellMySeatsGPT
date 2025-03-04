import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileDown, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type ReportType = 'tickets' | 'users' | 'sales';

export function ExportReports() {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<ReportType | null>(null);

  const exportMutation = useMutation({
    mutationFn: async (type: ReportType) => {
      setDownloading(type);
      const response = await apiRequest('GET', `/api/admin/export/${type}`, null, {
        headers: {
          'Accept': 'text/csv'
        }
      });
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: (_, type) => {
      toast({
        title: "Export Successful",
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} report has been downloaded.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setDownloading(null);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Reports</CardTitle>
        <CardDescription>
          Download detailed reports of your platform's data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            onClick={() => exportMutation.mutate('tickets')}
            disabled={!!downloading}
            className="w-full"
          >
            {downloading === 'tickets' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            Export Tickets
          </Button>
          <Button
            onClick={() => exportMutation.mutate('users')}
            disabled={!!downloading}
            className="w-full"
          >
            {downloading === 'users' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            Export Users
          </Button>
          <Button
            onClick={() => exportMutation.mutate('sales')}
            disabled={!!downloading}
            className="w-full"
          >
            {downloading === 'sales' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            Export Sales
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
