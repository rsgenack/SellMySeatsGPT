import { Ticket } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit } from "lucide-react";

interface TicketListProps { 
  tickets: Ticket[];
  onView?: (ticket: Ticket) => void;
  onEdit?: (ticket: Ticket) => void;
}

export default function TicketList({ tickets, onView, onEdit }: TicketListProps) {
  if (tickets.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No tickets listed yet. Start by forwarding your ticket emails or creating a new listing.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Section</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((ticket) => (
            <TableRow key={ticket.id}>
              <TableCell className="font-medium">
                {ticket.eventName}
              </TableCell>
              <TableCell>{new Date(ticket.eventDate).toLocaleDateString()}</TableCell>
              <TableCell>{ticket.venue}</TableCell>
              <TableCell>
                Section {ticket.section}, Row {ticket.row}, Seat {ticket.seat}
              </TableCell>
              <TableCell>${ticket.askingPrice}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    ticket.status === "sold"
                      ? "default"
                      : ticket.status === "pending"
                      ? "secondary"
                      : "destructive"
                  }
                >
                  {ticket.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right space-x-2">
                {onView && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onView(ticket)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                {onEdit && ticket.status === "pending" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(ticket)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}