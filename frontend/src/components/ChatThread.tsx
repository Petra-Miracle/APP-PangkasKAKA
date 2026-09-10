import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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

const POLL_INTERVAL = 2000;
const PENDING_MATCH_WINDOW_MS = 20000;

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
  // Pesan yang baru dikirim tapi belum tentu sudah kebawa di response GET
  // berikutnya (mis. polling background nyelip di antara POST dan GET-ulang
  // setelah kirim) — kalau tidak dijaga, full-replace di bawah bisa bikin
  // pesan yang baru saja dikirim sempat "hilang" sekilas sebelum muncul lagi.
  const pendingRef = useRef<ChatMessage[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await api.get(fetchUrl);
      const serverMsgs = getMessages(r);
      const now = Date.now();
      pendingRef.current = pendingRef.current.filter((p) => {
        const stillFresh = now - new Date(p.created_at).getTime() < PENDING_MATCH_WINDOW_MS;
        const alreadyOnServer = serverMsgs.some(
          (s) => s.sender_id === p.sender_id && s.text === p.text && s.attachment === p.attachment
        );
        return stillFresh && !alreadyOnServer;
      });
      setMessages(pendingRef.current.length ? [...serverMsgs, ...pendingRef.current] : serverMsgs);
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
    pendingRef.current = [...pendingRef.current, optimistic];
    setMessages((prev) => [...prev, optimistic]);
    setText(""); setAttachment("");
    setSending(true);
    try {
      await api.post(sendUrl, { text: optimistic.text, attachment: optimistic.attachment });
      await load();
    } catch (e: any) {
      pendingRef.current = pendingRef.current.filter((m) => m.id !== tempId);
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
          {messages.map((m, i) => {
            const mine = m.sender_id === user?.id;
            const showDay = i === 0 || dayLabel(messages[i - 1]?.created_at) !== dayLabel(m.created_at);
            return (
              <Fragment key={m.id}>
                {showDay && (
                  <View style={styles.dayPill}>
                    <Text style={styles.dayPillText}>{dayLabel(m.created_at)}</Text>
                  </View>
                )}
                <View style={[styles.msgRow, mine ? styles.rowRight : styles.rowLeft]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMe : styles.bubbleThem]}>
                    {!mine && m.sender_name ? <Text style={styles.senderName}>{m.sender_name}{m.sender_role ? ` · ${m.sender_role}` : ""}</Text> : null}
                    {m.text ? <Text style={[styles.msgText, mine && { color: COLORS.onBrand }]}>{m.text}</Text> : null}
                    {m.attachment ? <Image source={{ uri: m.attachment }} style={styles.msgImg} contentFit="cover" /> : null}
                    <Text style={[styles.time, mine && { color: "rgba(15,26,46,0.6)" }]}>{new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(/\./g, ":")}</Text>
                  </View>
                </View>
              </Fragment>
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
              <Pressable onPress={pickAttachment} style={styles.composerBtn}><Ionicons name="image" size={22} color={COLORS.brandLight} /></Pressable>
              <TextInput style={styles.composerInput} value={text} onChangeText={setText} placeholder="Tulis pesan..." placeholderTextColor={COLORS.textDim} multiline testID="chat-input" />
              <LinearGradient
                colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.sendBtn, (!text.trim() && !attachment) && { opacity: 0.4 }]}
              >
                <Pressable onPress={send} disabled={sending || (!text.trim() && !attachment)} testID="chat-send" style={styles.sendPress}>
                  <Ionicons name="send" size={18} color={COLORS.onBrand} />
                </Pressable>
              </LinearGradient>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function dayLabel(iso?: string): string {
  const d = new Date(iso || "");
  if (isNaN(d.getTime())) return "";
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
  if (diffDays <= 0) return "Hari ini";
  if (diffDays === 1) return "Kemarin";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: "hidden", shadowColor: COLORS.sidebar, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 8 },
  headerDeco: { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.06)", top: -64, right: -34 },
  iconBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  hAvatarRing: { width: 50, height: 50, borderRadius: 25, borderWidth: 2.5, borderColor: COLORS.gold, alignItems: "center", justifyContent: "center" },
  hAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  hTitle: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 16 },
  hSub: { color: "rgba(255,255,255,0.8)", fontFamily: FONT.medium, fontSize: 11, marginTop: 1 },
  emptyBox: { alignItems: "center", padding: 44, gap: 12 },
  emptyIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.brand },
  empty: { color: COLORS.textDim, fontFamily: FONT.medium, textAlign: "center", fontSize: 13 },
  dayPill: { alignSelf: "center", backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, marginVertical: 4 },
  dayPillText: { color: COLORS.textDim, fontFamily: FONT.semibold, fontSize: 11 },
  msgRow: { flexDirection: "row" },
  rowRight: { justifyContent: "flex-end" },
  rowLeft: { justifyContent: "flex-start" },
  bubble: { maxWidth: "78%", padding: 12, borderRadius: 18 },
  bubbleMe: {
    backgroundColor: COLORS.brand, borderBottomRightRadius: 4,
    shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 4,
  },
  bubbleThem: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderBottomLeftRadius: 4,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  senderName: { color: COLORS.brandLight, fontSize: 10, fontFamily: FONT.bold, marginBottom: 4, letterSpacing: 0.3, textTransform: "uppercase" },
  msgText: { color: COLORS.text, fontFamily: FONT.medium, fontSize: 13, lineHeight: 19 },
  msgImg: { width: 210, height: 210, borderRadius: 12, marginTop: 8 },
  time: { color: COLORS.textDim, fontSize: 10, marginTop: 5, fontFamily: FONT.medium, alignSelf: "flex-end" },
  composer: {
    backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border, padding: 12,
    shadowColor: COLORS.cardShadowStrong, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.6, shadowRadius: 14, elevation: 7,
  },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  composerBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  composerInput: { flex: 1, backgroundColor: COLORS.surface2, color: COLORS.text, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 22, borderWidth: 1, borderColor: COLORS.border, fontFamily: FONT.medium, fontSize: 14, maxHeight: 100 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", shadowColor: COLORS.brand, shadowOpacity: 0.35, shadowRadius: 10, elevation: 4 },
  sendPress: { width: "100%", height: "100%", borderRadius: 21, alignItems: "center", justifyContent: "center" },
  attachPreview: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.brandDim, padding: 10, borderRadius: 12, marginBottom: 10 },
  attachText: { flex: 1, color: COLORS.text, fontFamily: FONT.semibold, fontSize: 12 },
});