import { BookingForm } from "@/components/booking-form";
import { seedRooms } from "@/lib/catalog";

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">WISE U of T</p>
        <h1>Find a room that fits your event.</h1>
        <p>Submit a clear room request in one place. We will review availability and follow up with confirmation or alternatives.</p>
        <div className="hero__facts"><span>Capacity-aware suggestions</span><span>Photos when available</span><span>Coordinator updates by email</span></div>
      </section>
      <section className="booking-shell"><BookingForm initialRooms={seedRooms} /></section>
    </main>
  );
}
