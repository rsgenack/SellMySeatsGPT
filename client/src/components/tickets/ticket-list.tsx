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

export default function TicketList({ tickets }: { tickets: Ticket[] }) {
  if (tickets.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No tickets listed yet
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
