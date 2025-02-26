import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Ticket, ChevronRight, DollarSign, Shield } from "lucide-react";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b px-4 py-3">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">SellMySeats</h1>
          <div className="space-x-4">
            {user ? (
              <Link href="/dashboard">
                <Button>Dashboard</Button>
              </Link>
            ) : (
              <Link href="/auth">
                <Button>Sign In</Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main>
        <section className="py-20 px-4 bg-primary/5">
          <div className="container mx-auto text-center">
            <h1 className="text-5xl font-bold mb-6">
              The Smart Way to Sell Your Tickets
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Forward your ticket emails to your unique SellMySeats address and let us handle the rest. Quick, secure, and hassle-free.
            </p>
            <Link href={user ? "/dashboard" : "/auth"}>
              <Button size="lg" className="gap-2">
                Start Selling <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="container mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <Card>
                <CardContent className="p-6">
                  <div className="mb-4 p-3 bg-primary/10 w-fit rounded-lg">
                    <Ticket className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Forward Your Tickets</h3>
                  <p className="text-muted-foreground">
                    Simply forward your ticket confirmation emails to your unique SellMySeats address
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="mb-4 p-3 bg-primary/10 w-fit rounded-lg">
                    <DollarSign className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Set Your Price</h3>
                  <p className="text-muted-foreground">
                    Choose your asking price and let us handle the marketplace listing
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="mb-4 p-3 bg-primary/10 w-fit rounded-lg">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Secure Payment</h3>
                  <p className="text-muted-foreground">
                    Get paid securely once your tickets are sold to verified buyers
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-16 bg-muted/30 px-4">
          <div className="container mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Trusted by Event-Goers</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  venue: "Madison Square Garden",
                  location: "New York, NY",
                  image: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622",
                },
                {
                  venue: "Staples Center",
                  location: "Los Angeles, CA",
                  image: "https://images.unsplash.com/photo-1464047736614-af63643285bf",
                },
                {
                  venue: "United Center",
                  location: "Chicago, IL",
                  image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30",
                },
              ].map((venue, i) => (
                <Card key={i} className="overflow-hidden">
                  <img
                    src={venue.image}
                    alt={venue.venue}
                    className="w-full h-48 object-cover"
                  />
                  <CardContent className="p-4">
                    <h3 className="font-semibold">{venue.venue}</h3>
                    <p className="text-sm text-muted-foreground">{venue.location}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-primary text-primary-foreground py-12 px-4">
        <div className="container mx-auto text-center">
          <p className="text-sm opacity-90">&copy; 2024 SellMySeats. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}