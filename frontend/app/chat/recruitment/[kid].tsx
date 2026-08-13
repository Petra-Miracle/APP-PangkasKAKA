import { useLocalSearchParams } from "expo-router";
import ChatThread from "@/src/components/ChatThread";

export default function RecruitmentChatScreen() {
  const { kid } = useLocalSearchParams<{ kid: string }>();
  return (
    <ChatThread
      fetchUrl={`/recruitment/${kid}/messages`}
      sendUrl={`/recruitment/${kid}/messages`}
      title="Chat Rekrutmen"
      subtitle="Koordinasi seleksi & tes kerja"
      headerIcon="briefcase"
    />
  );
}
