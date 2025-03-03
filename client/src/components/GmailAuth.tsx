import { useQuery } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import { Loader2 } from "lucide-react";

export function GmailAuth() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/gmail/auth-url'],
    queryFn: async () => {
      const response = await fetch('/api/gmail/auth-url');
      if (!response.ok) {
        throw new Error('Failed to fetch Gmail auth URL');
      }
      return response.json();
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Failed to load Gmail authentication</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gmail Integration</CardTitle>
        <CardDescription>
          Connect your Gmail account to process ticket emails
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data?.isAuthenticated ? (
          <div className="text-green-600">
            Gmail is connected and monitoring for ticket emails
          </div>
        ) : data?.authUrl ? (
          <div className="space-y-4">
            <p>Please authorize access to Gmail to enable ticket processing:</p>
            <Button asChild>
              <a href={data.authUrl} target="_blank" rel="noopener noreferrer">
                Authorize Gmail Access
              </a>
            </Button>
          </div>
        ) : (
          <div className="text-red-600">
            Unable to initialize Gmail authentication
          </div>
        )}
      </CardContent>
    </Card>
  );
}
