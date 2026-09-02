import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import ChatThread from "@/src/components/ChatThread";
import { useAuth } from "@/src/lib/auth";

export default function RecruitmentChatScreen() {
  const { kid } = useLocalSearchParams<{ kid: string }>();
  const { user } = useAuth();
  const [applicantName, setApplicantName] = useState<string | null>(null);
  const title = user?.role === "karyawan" ? "Chat Validator" : (applicantName ? `Chat ${applicantName}` : "Chat Pelamar StreetBarber");
  return (
    <ChatThread
      fetchUrl={`/recruitment/${kid}/messages`}
      sendUrl={`/recruitment/${kid}/messages`}
      title={title}
      subtitle="Koordinasi validasi & tes keterampilan StreetBarber"
      headerIcon="briefcase"
      onData={(d) => setApplicantName(d?.karyawan?.name || null)}
    />
  );
}
