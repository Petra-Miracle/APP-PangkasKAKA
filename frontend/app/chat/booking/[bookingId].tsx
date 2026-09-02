import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import ChatThread from "@/src/components/ChatThread";
import { useAuth } from "@/src/lib/auth";

export default function BookingChatScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { user } = useAuth();
  const [barber, setBarber] = useState<{ name?: string; photo?: string } | null>(null);
  const [customer, setCustomer] = useState<{ name?: string; photo?: string } | null>(null);

  // Thread ini dipakai customer<->barber (toko maupun StreetBarber). Dari sisi
  // barber, lawan bicaranya adalah customer — bukan diri sendiri.
  const isKaryawan = user?.role === "karyawan";
  const other = isKaryawan ? customer : barber;

  return (
    <ChatThread
      fetchUrl={`/bookings/${bookingId}/messages`}
      sendUrl={`/bookings/${bookingId}/messages`}
      title={other?.name || (isKaryawan ? "Chat dengan Pelanggan" : "Chat dengan Barber")}
      subtitle="Tanya seputar pesananmu"
      headerImage={other?.photo}
      headerIcon={isKaryawan ? "person" : "cut"}
      onData={(d) => { setBarber(d?.barber || null); setCustomer(d?.customer || null); }}
    />
  );
}
