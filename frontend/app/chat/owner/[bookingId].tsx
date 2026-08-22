import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import ChatThread from "@/src/components/ChatThread";
import { useAuth } from "@/src/lib/auth";

export default function OwnerChatScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { user } = useAuth();
  const [shop, setShop] = useState<{ name?: string; image?: string } | null>(null);
  const [customer, setCustomer] = useState<{ name?: string; photo?: string } | null>(null);

  // Thread ini dipakai customer<->owner. Dari sisi owner, lawan bicaranya
  // adalah customer — bukan toko miliknya sendiri.
  const isOwner = user?.role === "owner";
  const other = isOwner ? customer : shop;

  return (
    <ChatThread
      fetchUrl={`/bookings/${bookingId}/owner-messages`}
      sendUrl={`/bookings/${bookingId}/owner-messages`}
      title={other?.name || (isOwner ? "Chat dengan Pelanggan" : "Chat dengan Toko")}
      subtitle="Tanya seputar pesanan atau tokonya"
      headerImage={isOwner ? customer?.photo : shop?.image}
      headerIcon={isOwner ? "person" : "storefront"}
      onData={(d) => { setShop(d?.shop || null); setCustomer(d?.customer || null); }}
    />
  );
}
