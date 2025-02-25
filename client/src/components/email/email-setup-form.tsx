import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const emailSetupSchema = z.object({
  user: z.string().email("Please enter a valid email address (forwarding@sellmyseats.com)"),
  password: z.string().min(1, "Gmail App Password is required"),
  host: z.string().min(1, "IMAP host server address is required"),
  port: z.coerce.number().min(1, "IMAP port number is required"),
  tls: z.boolean().default(true),
});

type EmailSetupForm = z.infer<typeof emailSetupSchema>;

export default function EmailSetupForm() {
  const { toast } = useToast();

  const form = useForm<EmailSetupForm>({
    resolver: zodResolver(emailSetupSchema),
    defaultValues: {
      tls: true,
      port: 993,
      host: "imap.gmail.com",
      user: "forwarding@sellmyseats.com"
    },
  });

  const setupMutation = useMutation({
    mutationFn: async (data: EmailSetupForm) => {
      await apiRequest("POST", "/api/admin/email-setup", data);
    },
    onSuccess: () => {
      toast({
        title: "Email Setup Complete",
        description: "Your Gmail account has been connected successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Setup Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const startMonitoringMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/email/start-monitoring");
    },
    onSuccess: () => {
      toast({
        title: "Email Monitoring Started",
        description: "The system is now checking for new ticket emails.",
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

  const onSubmit = (data: EmailSetupForm) => {
    setupMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You need to use a Gmail App Password, not your regular Gmail password. 
          To generate one:
          <ol className="mt-2 ml-4 list-decimal">
            <li>Go to your Google Account settings</li>
            <li>Navigate to Security &amp; 2-Step Verification</li>
            <li>Scroll to App passwords and generate a new one</li>
          </ol>
        </AlertDescription>
      </Alert>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="user"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormDescription>
                This is your Gmail address for receiving ticket emails (forwarding@sellmyseats.com)
              </FormDescription>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Gmail App Password</FormLabel>
              <FormDescription>
                Use the 16-character App Password generated from your Google Account settings.
                Regular Gmail password will not work.
              </FormDescription>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="host"
          render={({ field }) => (
            <FormItem>
              <FormLabel>IMAP Host</FormLabel>
              <FormDescription>
                For Gmail, this should always be imap.gmail.com
              </FormDescription>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="port"
          render={({ field }) => (
            <FormItem>
              <FormLabel>IMAP Port</FormLabel>
              <FormDescription>
                For Gmail, this should always be 993 (SSL/TLS port)
              </FormDescription>
              <FormControl>
                <Input type="number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={setupMutation.isPending}
            className="flex-1"
          >
            Save Configuration
          </Button>
          <Button
            type="button"
            onClick={() => startMonitoringMutation.mutate()}
            disabled={startMonitoringMutation.isPending}
            className="flex-1"
          >
            Start Monitoring
          </Button>
        </div>
      </form>
    </Form>
  );
}