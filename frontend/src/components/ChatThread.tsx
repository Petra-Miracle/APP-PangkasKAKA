import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { api, COLORS, FONT } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";

export type ChatMessage = {
  id: string;
  sender_id: string;
  sender_name?: string;
  sender_role?: string;
  text?: string;
  attachment?: string;
  created_at: string;
};

type Props = {
  fetchUrl: string;
  sendUrl: string;
  title: string;
  subtitle: string;
  headerImage?: string;
  headerIcon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  disabledLabel?: string;
  headerRight?: ReactNode;
  getMessages?: (data: any) => ChatMessage[];
  onData?: (data: any) => void;
};

const POLL_INTERVAL = 3000;

export default function ChatThread({
  fetchUrl, sendUrl, title, subtitle, headerImage, headerIcon = "person",
  disabled, disabledLabel = "Percakapan ditutup", headerRight,
  getMessages = (d) => d?.messages || [],
  onData,
}: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const pollingRef = useRef<any>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get(fetchUrl);
      setMessages(getMessages(r));
      onData?.(r);
    } catch {} finally { setLoading(false); }
  }, [fetchUrl, getMessages, onData]);

  useEffect(() => {
    load();
    pollingRef.current = setInterval(load, POLL_INTERVAL);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [load]);

  useEffect(() => { setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200); }, [messages.length]);

  useEffect(() => {
    const showEvt = Platform.OS === "android" ? "keyboardDidShow" : "keyboardWillShow";
    const sub = Keyboard.addListener(showEvt, () => {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => sub.remove();
  }, []);

  const pickAttachment = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;
    const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.5, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (res.canceled) return;
    setAttachment(`data:image/jpeg;base64,${res.assets[0].base64}`);
  };

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed && !attachment) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      sender_id: user?.id || "",
      sender_name: user?.name,
      sender_role: user?.role,
      text: trimmed,
      attachment,
      created_at: new Date().toISOString(),
    };
    // Tampilkan pesan langsung (optimistic) — sebelumnya UI menunggu POST + GET
    // (round-trip ganda) sebelum pesan muncul, terasa delay tiap kirim.
    setMessages((prev) => [...prev, optimistic]);
    setText(""); setAttachment("");
    setSending(true);
    try {
      await api.post(sendUrl, { text: optimistic.text, attachment: optimistic.attachment });
      await load();
    } catch (e: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      alert(e.message);
    }
    setSending(false);
  };

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient
        colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View pointerEvents="none" style={styles.headerDeco} />
        <Pressable onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={20} color="#FFFFFF" /></Pressable>
        <View style={styles.hAvatarRing}>
          <View style={styles.hAvatar}>
            {headerImage ? <Image source={{ uri: headerImage }} style={{ width: 38, height: 38 }} /> : <Ionicons name={headerIcon} size={18} color="#FFFFFF" />}
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.hTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.hSub} numberOfLines={1}>{disabled ? disabledLabel : subtitle}</Text>
        </View>
        {headerRight}
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, gap: 10 }} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
          {messages.length === 0 && (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIcon}><Ionicons name="chatbubbles-outline" size={40} color={COLORS.brand} /></View>
              <Text style={styles.empty}>Belum ada pesan. Mulai percakapan.</Text>
            </View>
          )}
          {messages.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <View key={m.id} style={[styles.msgRow, mine ? styles.rowRight : styles.rowLeft]}>
                <View style={[styles.bubble, mine ? styles.bubbleMe : styles.bubbleThem]}>
                  {!mine && m.sender_name ? <Text style={styles.senderName}>{m.sender_name}{m.sender_role ? ` · ${m.sender_role}` : ""}</Text> : null}
                  {m.text ? <Text style={[styles.msgText, mine && { color: "#FFFFFF" }]}>{m.text}</Text> : null}
                  {m.attachment ? <Image source={{ uri: m.attachment }} style={styles.msgImg} contentFit="cover" /> : null}
                  <Text style={[styles.time, mine && { color: "rgba(255,255,255,0.7)" }]}>{new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {!disabled && (
          <View style={styles.composer}>
            {attachment ? (
              <View style={styles.attachPreview}>
                <Image source={{ uri: attachment }} style={{ width: 40, height: 40, borderRadius: 8 }} contentFit="cover" />
                <Text style={styles.attachText}>Lampiran siap</Text>
                <Pressable onPress={() => setAttachment("")}><Ionicons name="close-circle" size={20} color={COLORS.error} /></Pressable>
              </View>
            ) : null}
            <View style={styles.composerRow}>
              <Pressable onPress={pickAttachment} style={styles.composerBtn}><Ionicons name="image" size={22} color={COLORS.brand} /></Pressable>
              <TextInput style={styles.composerInput} value={text} onChangeText={setText} placeholder="Tulis pesan..." placeholderTextColor={COLORS.textDim} multiline testID="chat-input" />
              <LinearGradient
                colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.sendBtn, (!text.trim() && !attachment) && { opacity: 0.4 }]}
              >
                <Pressable onPress={send} disabled={sending || (!text.trim() && !attachment)} testID="chat-send" style={styles.sendPress}>
                  <Ionicons name="send" size={18} color="#FFFFFF" />
                </Pressable>
              </LinearGradient>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderBottomLeftRadius: 22, borderBottomRightRadius: 22, overflow: "hidden", shadowColor: COLORS.sidebar, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6 },
  headerDeco: { position: "absolute", width: 150, height: 150, borderRadius: 75, backgroundColor: "rgba(255,255,255,0.06)", top: -60, right: -30 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  hAvatarRing: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: COLORS.gold, alignItems: "center", justifyContent: "center" },
  hAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  hTitle: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 15 },
  hSub: { color: "rgba(255,255,255,0.8)", fontFamily: FONT.medium, fontSize: 11 },
  emptyBox: { alignItems: "center", padding: 40, gap: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  empty: { color: COLORS.textDim, fontFamily: FONT.medium, textAlign: "center" },
  msgRow: { flexDirection: "row" },
  rowRight: { justifyContent: "flex-end" },
  rowLeft: { justifyContent: "flex-start" },
  bubble: { maxWidth: "78%", padding: 10, borderRadius: 16 },
  bubbleMe: {
    backgroundColor: COLORS.brand, borderBottomRightRadius: 4,
    shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 3,
  },
  bubbleThem: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderBottomLeftRadius: 4,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 6, elevation: 1,
  },
  senderName: { color: COLORS.brand, fontSize: 10, fontFamily: FONT.bold, marginBottom: 4, letterSpacing: 0.3, textTransform: "uppercase" },
  msgText: { color: COLORS.text, fontFamily: FONT.medium, fontSize: 13, lineHeight: 18 },
  msgImg: { width: 200, height: 200, borderRadius: 10, marginTop: 6 },
  time: { color: COLORS.textDim, fontSize: 10, marginTop: 4, fontFamily: FONT.medium, alignSelf: "flex-end" },
  composer: {
    backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border, padding: 10,
    shadowColor: COLORS.cardShadowStrong, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.6, shadowRadius: 12, elevation: 6,
  },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  composerBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  composerInput: { flex: 1, backgroundColor: COLORS.surface2, color: COLORS.text, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, fontFamily: FONT.medium, fontSize: 14, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3 },
  sendPress: { width: "100%", height: "100%", borderRadius: 20, alignItems: "center", justifyContent: "center" },
  attachPreview: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.brandDim, padding: 8, borderRadius: 10, marginBottom: 8 },
  attachText: { flex: 1, color: COLORS.text, fontFamily: FONT.semibold, fontSize: 12 },
});