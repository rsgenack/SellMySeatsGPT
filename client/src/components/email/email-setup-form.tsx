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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const emailSetupSchema = z.object({
  user: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  host: z.string().min(1, "IMAP host is required"),
  port: z.coerce.number().min(1, "Port is required"),
  tls: z.boolean().default(true),
});

type EmailSetupForm = z.infer<typeof emailSetupSchema>;

export default function EmailSetupForm() {
  const { toast } = useToast();

  const form = useForm<EmailSetupForm>({
    resolver: zodResolver(emailSetupSchema),
    defaultValues: {
      tls: true,
    },
  });

  const setupMutation = useMutation({
    mutationFn: async (data: EmailSetupForm) => {
      await apiRequest("POST", "/api/admin/email-setup", data);
    },
    onSuccess: () => {
      toast({
        title: "Email Setup Complete",
        description: "Your email account has been connected successfully.",
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="user"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <Input placeholder="your.email@example.com" {...field} />
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
              <FormLabel>Email Password</FormLabel>
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
              <FormControl>
                <Input placeholder="imap.gmail.com" {...field} />
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
              <FormControl>
                <Input type="number" placeholder="993" {...field} />
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