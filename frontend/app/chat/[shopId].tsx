import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, COLORS, FONT } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";

const DOC_LABEL: Record<string, string> = {
  ktp: "KTP", nib: "NIB", npwp: "NPWP", surat_usaha: "Surat Izin Usaha", toko: "Foto Toko",
};

export default function ChatScreen() {
  const { shopId } = useLocalSearchParams<{ shopId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [thread, setThread] = useState<any>(null);
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<string>("");
  const [docRef, setDocRef] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const pollingRef = useRef<any>(null);
  // Sama seperti ChatThread.tsx: jaga pesan yang baru dikirim tapi belum tentu
  // sudah kebawa di response GET berikutnya (polling background bisa nyelip
  // di antara POST dan GET-ulang setelah kirim), supaya tidak sempat "hilang".
  const pendingRef = useRef<any[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/chat/threads/${shopId}`);
      const serverMsgs = r?.messages || [];
      const now = Date.now();
      pendingRef.current = pendingRef.current.filter((p) => {
        const stillFresh = now - new Date(p.created_at).getTime() < 20000;
        const alreadyOnServer = serverMsgs.some(
          (s: any) => s.sender_id === p.sender_id && s.text === p.text && s.attachment === p.attachment
        );
        return stillFresh && !alreadyOnServer;
      });
      setThread(pendingRef.current.length ? { ...r, messages: [...serverMsgs, ...pendingRef.current] } : r);
      await api.post(`/chat/threads/${shopId}/read`).catch(() => {});
    } catch (e) {} finally { setLoading(false); }
  }, [shopId]);

  useEffect(() => {
    load();
    pollingRef.current = setInterval(load, 2000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [load]);

  useEffect(() => { setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200); }, [thread?.messages?.length]);

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
    const optimistic = {
      id: tempId,
      sender_id: user?.id,
      sender_name: user?.name,
      sender_role: user?.role,
      text: trimmed,
      attachment,
      doc_ref: docRef,
      created_at: new Date().toISOString(),
    };
    // Optimistic append — sebelumnya pesan baru muncul setelah POST + GET
    // (round-trip ganda), terasa delay tiap kirim.
    pendingRef.current = [...pendingRef.current, optimistic];
    setThread((prev: any) => (prev ? { ...prev, messages: [...(prev.messages || []), optimistic] } : prev));
    setText(""); setAttachment(""); setDocRef("");
    setSending(true);
    try {
      await api.post(`/chat/threads/${shopId}/messages`, { text: optimistic.text, attachment: optimistic.attachment, doc_ref: optimistic.doc_ref });
      await load();
    } catch (e: any) {
      pendingRef.current = pendingRef.current.filter((m) => m.id !== tempId);
      setThread((prev: any) => (prev ? { ...prev, messages: (prev.messages || []).filter((m: any) => m.id !== tempId) } : prev));
      alert(e.message);
    }
    setSending(false);
  };

  const closeThread = async () => {
    try { await api.post(`/chat/threads/${shopId}/close`); await load(); } catch (e: any) { alert(e.message); }
  };

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={20} color="#FFFFFF" /></Pressable>
        <View style={styles.hAvatar}>{thread?.shop?.image ? <Image source={{ uri: thread.shop.image }} style={{ width: 40, height: 40 }} /> : <Ionicons name="storefront" size={18} color="#FFFFFF" />}</View>
        <View style={{ flex: 1 }}>
          <Text style={styles.hTitle} numberOfLines={1}>{thread?.shop?.name}</Text>
          <Text style={styles.hSub}>{thread?.shop?.closed ? "Percakapan ditutup" : "Verifikasi dokumen"}</Text>
        </View>
        {user?.role === "admin" && !thread?.shop?.closed && (
          <Pressable onPress={closeThread} style={styles.iconBtn} testID="close-thread"><Ionicons name="lock-closed" size={18} color="#FFFFFF" /></Pressable>
        )}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, gap: 10 }}>
          {(thread?.messages || []).length === 0 && (
            <View style={styles.emptyBox}>
              <Ionicons name="chatbubbles-outline" size={40} color={COLORS.textDim} />
              <Text style={styles.empty}>Belum ada pesan. Mulai percakapan.</Text>
            </View>
          )}
          {(thread?.messages || []).map((m: any) => {
            const mine = m.sender_id === user?.id;
            return (
              <View key={m.id} style={[styles.msgRow, mine ? styles.rowRight : styles.rowLeft]}>
                <View style={[styles.bubble, mine ? styles.bubbleMe : styles.bubbleThem]}>
                  {!mine && <Text style={styles.senderName}>{m.sender_name} · {m.sender_role}</Text>}
                  {m.doc_ref ? <View style={styles.docTag}><Ionicons name="document-attach" size={11} color={mine ? "#FFFFFF" : COLORS.brand} /><Text style={[styles.docTagText, mine && { color: "#FFFFFF" }]}>{DOC_LABEL[m.doc_ref] || m.doc_ref}</Text></View> : null}
                  {m.text ? <Text style={[styles.msgText, mine && { color: "#FFFFFF" }]}>{m.text}</Text> : null}
                  {m.attachment ? <Image source={{ uri: m.attachment }} style={styles.msgImg} contentFit="cover" /> : null}
                  <Text style={[styles.time, mine && { color: "rgba(255,255,255,0.7)" }]}>{new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {!thread?.shop?.closed && (
          <View style={styles.composer}>
            {attachment ? (
              <View style={styles.attachPreview}>
                <Image source={{ uri: attachment }} style={{ width: 40, height: 40, borderRadius: 8 }} contentFit="cover" />
                <Text style={styles.attachText}>Lampiran siap</Text>
                <Pressable onPress={() => setAttachment("")}><Ionicons name="close-circle" size={20} color={COLORS.error} /></Pressable>
              </View>
            ) : null}
            {docRef ? (
              <View style={styles.docRefChip}>
                <Ionicons name="document-attach" size={12} color={COLORS.brand} />
                <Text style={styles.docRefText}>Tentang: {DOC_LABEL[docRef]}</Text>
                <Pressable onPress={() => setDocRef("")}><Ionicons name="close" size={14} color={COLORS.textDim} /></Pressable>
              </View>
            ) : null}
            <View style={styles.composerRow}>
              <Pressable onPress={pickAttachment} style={styles.composerBtn}><Ionicons name="image" size={22} color={COLORS.brand} /></Pressable>
              <Pressable onPress={() => { const opts = ["ktp", "nib", "npwp", "surat_usaha", "toko"]; const cur = opts.indexOf(docRef); setDocRef(opts[(cur + 1) % opts.length]); }} style={styles.composerBtn}>
                <Ionicons name="link" size={20} color={COLORS.brand} />
              </Pressable>
              <TextInput style={styles.composerInput} value={text} onChangeText={setText} placeholder="Tulis pesan..." placeholderTextColor={COLORS.textDim} multiline testID="chat-input" />
              <Pressable style={[styles.sendBtn, (!text.trim() && !attachment) && { opacity: 0.4 }]} onPress={send} disabled={sending || (!text.trim() && !attachment)} testID="chat-send">
                <Ionicons name="send" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.brand, paddingHorizontal: 12, paddingVertical: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  hAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  hTitle: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 14 },
  hSub: { color: "rgba(255,255,255,0.8)", fontFamily: FONT.medium, fontSize: 11 },
  emptyBox: { alignItems: "center", padding: 40, gap: 8 },
  empty: { color: COLORS.textDim, fontFamily: FONT.medium, textAlign: "center" },
  msgRow: { flexDirection: "row" },
  rowRight: { justifyContent: "flex-end" },
  rowLeft: { justifyContent: "flex-start" },
  bubble: { maxWidth: "78%", padding: 10, borderRadius: 14 },
  bubbleMe: { backgroundColor: COLORS.brand, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderBottomLeftRadius: 4 },
  senderName: { color: COLORS.textDim, fontSize: 10, fontFamily: FONT.bold, marginBottom: 4, letterSpacing: 0.3, textTransform: "uppercase" },
  docTag: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 4 },
  docTagText: { color: COLORS.brand, fontSize: 10, fontFamily: FONT.bold },
  msgText: { color: COLORS.text, fontFamily: FONT.medium, fontSize: 13, lineHeight: 18 },
  msgImg: { width: 200, height: 200, borderRadius: 10, marginTop: 6 },
  time: { color: COLORS.textDim, fontSize: 10, marginTop: 4, fontFamily: FONT.medium, alignSelf: "flex-end" },
  composer: { backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border, padding: 10 },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  composerBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  composerInput: { flex: 1, backgroundColor: COLORS.surface2, color: COLORS.text, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, fontFamily: FONT.medium, fontSize: 14, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center" },
  attachPreview: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.brandDim, padding: 8, borderRadius: 10, marginBottom: 8 },
  attachText: { flex: 1, color: COLORS.text, fontFamily: FONT.semibold, fontSize: 12 },
  docRefChip: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: COLORS.brandDim, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: 8 },
  docRefText: { color: COLORS.brand, fontFamily: FONT.bold, fontSize: 11 },
});
