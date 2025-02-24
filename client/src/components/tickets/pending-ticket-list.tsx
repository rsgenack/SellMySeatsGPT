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

interface ExtractedTicketData {
  eventName: string;
  eventDate: string;
  venue: string;
  section: string;
  row: string;
  seat: string;
  price: number;
}

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
      {tickets.map((ticket) => {
        const extractedData = ticket.extractedData as ExtractedTicketData;

        return (
          <Card key={ticket.id}>
            <CardHeader>
              <CardTitle>{ticket.emailSubject}</CardTitle>
              <CardDescription>From: {ticket.emailFrom}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <strong>Event:</strong> {extractedData.eventName}
                </div>
                <div>
                  <strong>Date:</strong> {extractedData.eventDate}
                </div>
                <div>
                  <strong>Location:</strong> {extractedData.venue}
                </div>
                <div>
                  <strong>Section:</strong> {extractedData.section}
                </div>
                <div>
                  <strong>Row:</strong> {extractedData.row}
                </div>
                <div>
                  <strong>Seat:</strong> {extractedData.seat}
                </div>
                <div>
                  <strong>Price:</strong> ${extractedData.price}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={() => 
                  confirmMutation.mutate({
                    id: ticket.id,
                    data: {
                      eventName: extractedData.eventName,
                      eventDate: extractedData.eventDate,
                      venue: extractedData.venue,
                      section: extractedData.section,
                      row: extractedData.row,
                      seat: extractedData.seat,
                      askingPrice: extractedData.price,
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
        );
      })}
    </div>
  );
}