import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import EmailSetupForm from "@/components/email/email-setup-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import AdminNav from "@/components/layout/admin-nav";

export default function AdminEmailSetupPage() {
  const { user } = useAuth();

  if (!user?.isAdmin) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b px-4 py-3">
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold text-primary">Admin Dashboard</h1>
        </div>
      </nav>

      <AdminNav />

      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Email Service Configuration</CardTitle>
            <CardDescription>
              Configure the email service to process incoming ticket emails. This service will monitor
              for new ticket submissions and automatically process them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmailSetupForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}