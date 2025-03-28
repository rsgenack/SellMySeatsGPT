import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

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
        <section className="py-20 px-4">
          <div className="container mx-auto text-center">
            <h1 className="text-5xl font-bold mb-6">
              The Easiest Way to Sell Your Tickets
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              List your tickets for sale and let us handle the rest. Get paid when your tickets sell.
            </p>
            <Link href={user ? "/dashboard" : "/auth"}>
              <Button size="lg">Get Started</Button>
            </Link>
          </div>
        </section>

        <section className="py-16 bg-muted/30 px-4">
          <div className="container mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  title: "List Your Tickets",
                  description: "Upload your ticket details and set your price",
                  image: "https://images.unsplash.com/photo-1623068285726-21b0fcabe7f8",
                },
                {
                  title: "We Handle Sales",
                  description: "We market and sell your tickets to buyers",
                  image: "https://images.unsplash.com/photo-1515139372923-c923c9e9a18c",
                },
                {
                  title: "Get Paid",
                  description: "Receive payment once tickets are sold",
                  image: "https://images.unsplash.com/photo-1568667075686-306d743e6dc9",
                },
              ].map((item, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-48 object-cover rounded-lg mb-4"
                    />
                    <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                    <p className="text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="container mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Clients We Support</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30",
                  title: "Regular Fans [UPDATE]",
                  description: "Perfect for occasional event-goers looking to sell their tickets"
                },
                {
                  image: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622",
                  title: "Season Ticket Holders",
                  description: "Manage and sell your season tickets with ease"
                },
                {
                  image: "https://images.unsplash.com/photo-1464047736614-af63643285bf",
                  title: "Corporate Clients",
                  description: "Solutions for businesses with bulk ticket holdings"
                },
              ].map((client, i) => (
                <Link key={i} href="/auth">
                  <div className="group cursor-pointer">
                    <div className="relative overflow-hidden rounded-lg transition-transform duration-300 transform group-hover:scale-105">
                      <img
                        src={client.image}
                        alt={client.title}
                        className="w-full h-64 object-cover rounded-lg transition-transform duration-300 transform group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <span className="text-white text-lg font-serif tracking-wide">Learn More</span>
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold mt-4 mb-2">{client.title}</h3>
                    <p className="text-muted-foreground text-sm">{client.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-primary text-primary-foreground py-12 px-4">
        <div className="container mx-auto text-center">
          <p>&copy; 2024 SellMySeats. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}