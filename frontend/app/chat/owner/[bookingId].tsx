import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import ChatThread from "@/src/components/ChatThread";

export default function OwnerChatScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [shop, setShop] = useState<{ name?: string; image?: string } | null>(null);

  return (
    <ChatThread
      fetchUrl={`/bookings/${bookingId}/owner-messages`}
      sendUrl={`/bookings/${bookingId}/owner-messages`}
      title={shop?.name || "Chat dengan Toko"}
      subtitle="Tanya seputar pesanan atau tokonya"
      headerImage={shop?.image}
      headerIcon="storefront"
      onData={(d) => setShop(d?.shop || null)}
    />
  );
}
