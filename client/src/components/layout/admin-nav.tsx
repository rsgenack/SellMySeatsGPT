import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

export default function AdminNav() {
  return (
    <nav className="flex items-center gap-4 px-4 py-2 bg-muted/30">
      <Link href="/admin/email-setup">
        <Button variant="ghost" size="sm" className="gap-2">
          <Mail className="h-4 w-4" />
          Email Setup
        </Button>
      </Link>
    </nav>
  );
}
