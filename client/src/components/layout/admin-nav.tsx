import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Mail, Settings } from "lucide-react";

export default function AdminNav() {
  const [location] = useLocation();

  return (
    <nav className="border-b bg-muted/30">
      <div className="container mx-auto">
        <div className="flex items-center gap-4 px-4 py-2">
          <span className="text-sm font-medium text-muted-foreground">Admin Tools:</span>
          <Link href="/admin/email-setup">
            <Button 
              variant={location === "/admin/email-setup" ? "secondary" : "ghost"} 
              size="sm" 
              className="gap-2"
            >
              <Mail className="h-4 w-4" />
              Email Setup
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}