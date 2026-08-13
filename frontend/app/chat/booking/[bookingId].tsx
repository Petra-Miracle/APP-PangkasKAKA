import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import ChatThread from "@/src/components/ChatThread";

export default function BookingChatScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [barber, setBarber] = useState<{ name?: string; photo?: string } | null>(null);

  return (
    <ChatThread
      fetchUrl={`/bookings/${bookingId}/messages`}
      sendUrl={`/bookings/${bookingId}/messages`}
      title={barber?.name || "Chat dengan Barber"}
      subtitle="Tanya seputar pesananmu"
      headerImage={barber?.photo}
      headerIcon="cut"
      onData={(d) => setBarber(d?.barber || null)}
    />
  );
}
