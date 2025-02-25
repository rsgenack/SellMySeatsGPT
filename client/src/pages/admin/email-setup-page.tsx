import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import EmailSetupForm from "@/components/email/email-setup-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminEmailSetupPage() {
  const { user } = useAuth();

  if (!user?.isAdmin) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Email Service Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <EmailSetupForm />
        </CardContent>
      </Card>
    </div>
  );
}
