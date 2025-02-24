import { PendingTicket } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function PendingTicketList({ tickets }: { tickets: PendingTicket[] }) {
  const { toast } = useToast();
  
  const confirmMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("POST", `/api/pending-tickets/${id}/confirm`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pending-tickets"] });
      toast({
        title: "Success",
        description: "Ticket confirmed and listed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (tickets.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4">
      {tickets.map((ticket) => (
        <Card key={ticket.id}>
          <CardHeader>
            <CardTitle>{ticket.emailSubject}</CardTitle>
            <CardDescription>From: {ticket.emailFrom}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <strong>Event:</strong> {ticket.extractedData.eventName}
              </div>
              <div>
                <strong>Date:</strong> {ticket.extractedData.eventDate}
              </div>
              <div>
                <strong>Location:</strong> {ticket.extractedData.venue}
              </div>
              <div>
                <strong>Section:</strong> {ticket.extractedData.section}
              </div>
              <div>
                <strong>Row:</strong> {ticket.extractedData.row}
              </div>
              <div>
                <strong>Seat:</strong> {ticket.extractedData.seat}
              </div>
              <div>
                <strong>Price:</strong> ${ticket.extractedData.price}
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={() => 
                confirmMutation.mutate({
                  id: ticket.id,
                  data: {
                    ...ticket.extractedData,
                    askingPrice: ticket.extractedData.price,
                  },
                })
              }
              disabled={confirmMutation.isPending}
            >
              {confirmMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm and List Ticket
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
