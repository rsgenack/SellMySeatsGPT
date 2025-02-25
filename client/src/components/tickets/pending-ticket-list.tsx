import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PendingTicket } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

export default function PendingTicketList() {
  const { data: pendingTickets = [] } = useQuery<PendingTicket[]>({
    queryKey: ["/api/pending-tickets"],
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const confirmMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/pending-tickets/${id}/confirm`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pending-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      toast({
        title: "Ticket Confirmed",
        description: "The ticket has been added to your inventory.",
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

  // Filter to only show pending tickets
  const pendingOnlyTickets = pendingTickets.filter(ticket => ticket.status === "pending");

  if (pendingOnlyTickets.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No pending tickets found. Forward your tickets to your unique email address to add them to your inventory.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Event</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Venue</TableHead>
          <TableHead>Section</TableHead>
          <TableHead>Row</TableHead>
          <TableHead>Seat</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pendingOnlyTickets.map((ticket) => {
          const extractedData = ticket.extractedData as any;
          return (
            <TableRow key={ticket.id}>
              <TableCell>{extractedData.eventName}</TableCell>
              <TableCell>{extractedData.eventDate}</TableCell>
              <TableCell>{extractedData.venue}</TableCell>
              <TableCell>{extractedData.section}</TableCell>
              <TableCell>{extractedData.row}</TableCell>
              <TableCell>{extractedData.seat}</TableCell>
              <TableCell>{ticket.status}</TableCell>
              <TableCell>
                <Button
                  size="sm"
                  onClick={() => confirmMutation.mutate(ticket.id)}
                  disabled={confirmMutation.isPending}
                >
                  Confirm
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}