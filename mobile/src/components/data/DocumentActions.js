import { useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import { Button, ErrorBox, useFeedback } from "../ui";
import { TextField } from "../forms";
import { printHtml, sendViaWhatsAppApi, sharePdf, whatsappApiReady } from "../../print/documents";
import { colors } from "../../theme";

// Print / Share PDF / Send-via-WhatsApp-API buttons for a document detail
// screen. `build()` returns the HTML (it's async so it can load settings and
// the party record on demand).
export default function DocumentActions({ build, filename, settings, whatsapp }) {
  const { toast } = useFeedback();
  const [busy, setBusy] = useState("");
  const [waOpen, setWaOpen] = useState(false);
  const [waPhone, setWaPhone] = useState("");
  const [waError, setWaError] = useState("");

  const run = async (kind, fn) => {
    if (busy) return;
    setBusy(kind);
    try {
      await fn();
    } catch (err) {
      toast(err.message || "Something went wrong.");
    } finally {
      setBusy("");
    }
  };

  const sendWa = async () => {
    setWaError("");
    setBusy("wa");
    try {
      const html = await build();
      const res = await sendViaWhatsAppApi({ html, to: waPhone, filename, ...whatsapp });
      setWaOpen(false);
      toast(`Sent on WhatsApp to ${res.to || waPhone}`);
    } catch (err) {
      setWaError(err.message || "Could not send the document.");
    } finally {
      setBusy("");
    }
  };

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <Button small variant="secondary" icon="share" title={Platform.OS === "web" ? "PDF" : "Share PDF"} loading={busy === "share"} onPress={() => run("share", async () => sharePdf(await build(), filename))} />
      <Button small variant="secondary" icon="printer" title="Print" loading={busy === "print"} onPress={() => run("print", async () => printHtml(await build()))} />
      {whatsapp && whatsappApiReady(settings) ? (
        <Button
          small
          variant="secondary"
          icon="whatsapp"
          title="Send via WhatsApp"
          onPress={() => {
            setWaPhone(String(whatsapp.defaultPhone || "").replace(/\D/g, ""));
            setWaError("");
            setWaOpen(true);
          }}
        />
      ) : null}

      <Modal visible={waOpen} transparent animationType="fade" onRequestClose={() => setWaOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,.4)", justifyContent: "center", padding: 24 }} onPress={() => setWaOpen(false)}>
          <Pressable style={{ backgroundColor: "#fff", borderRadius: 14, padding: 18 }} onPress={() => {}}>
            <Text style={{ fontSize: 17, fontWeight: "700", marginBottom: 6 }}>Send via WhatsApp</Text>
            <Text style={{ color: colors.textMuted, marginBottom: 12 }}>The PDF is sent from your WhatsApp Business account.</Text>
            <ErrorBox message={waError} />
            <TextField label="Mobile number" value={waPhone} onChangeText={(v) => setWaPhone(v.replace(/[^\d+]/g, ""))} keyboardType="phone-pad" />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setWaOpen(false)} />
              <Button title="Send" style={{ flex: 1 }} loading={busy === "wa"} onPress={sendWa} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
