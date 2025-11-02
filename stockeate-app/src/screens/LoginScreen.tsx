import React, { useState } from "react";
import { View, TextInput, Text, TouchableOpacity, Modal, ActivityIndicator, Dimensions, ScrollView, KeyboardAvoidingView, Platform, useColorScheme } from "react-native";
import { useAuth } from "../stores/auth";
import { api } from "../api";

export default function LoginScreen() {
  const { login, register, logout, token } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);  const [showForgot, setShowForgot] = useState(false);
  const [fEmail, setFEmail] = useState("");
  const [fSending, setFSending] = useState(false);
  const [fSent, setFSent] = useState(false);

  const [showReset, setShowReset] = useState(false);
  const [rToken, setRToken] = useState("");
  const [rPass, setRPass] = useState("");
  const [rLoading, setRLoading] = useState(false);
  const [rMsg, setRMsg] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setErr(null);
    setLoading(true);
    try {
      await fn();
    } catch (e: any) {
      const d = e?.response?.data;
      const msg = Array.isArray(d?.message) ? d.message.join(", ") : (d?.message || e?.message || "Error");
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  const doForgot = async () => {
    try {
      setFSending(true);
      setFSent(false);
      await api.post("/auth/forgot", { email: fEmail.trim() });
      setFSent(true);
    } catch {
    setFSent(true);
    } finally {
      setFSending(false);
    }
  };

  const doReset = async () => {
    setRMsg(null);
    setRLoading(true);
    try {
      await api.post("/auth/reset", { token: rToken.trim(), newPassword: rPass });
      setRMsg("Contraseña actualizada. Ahora podés iniciar sesión.");
      setShowReset(false);
      setShowForgot(false);
      setRPass("");
      setRToken("");
    } catch (e: any) {
      const d = e?.response?.data;
      const msg = Array.isArray(d?.message) ? d.message.join(", ") : (d?.message || e?.message || "Error");
      setRMsg(msg);
    } finally {
      setRLoading(false);
    }
  };

  const { width, height } = Dimensions.get('window');
  const isSmallScreen = width < 400 || height < 700;
  const containerPadding = isSmallScreen ? 12 : 20;
  const inputPadding = isSmallScreen ? 10 : 14;
  const buttonPadding = isSmallScreen ? 10 : 14;
  const titleSize = isSmallScreen ? 20 : 24;

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const isValidPassword = (password: string) => {
    return password.length >= 6;
  };

  const canSubmit = isValidEmail(email) && isValidPassword(pass) && !loading;

  const bgMain = isDark ? "#0b1220" : "#f8fafc";
  const bgInput = isDark ? "#121a2b" : "#ffffff";
  const textInput = isDark ? "#ffffff" : "#000000";
  const borderInput = isDark ? "#334155" : "#cbd5e1";
  const borderError = "#ef4444";
  const textTitle = isDark ? "white" : "#0f172a";
  const textSecondary = isDark ? "#94a3b8" : "#64748b";
  const bgModal = isDark ? "#0b1220" : "#ffffff";
  const borderModal = isDark ? "#1e293b" : "#e2e8f0";

  return (
    <View style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, backgroundColor: bgMain, padding: containerPadding, justifyContent: "center", minHeight: height }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={{ maxWidth: 400, width: '100%', alignSelf: 'center', gap: isSmallScreen ? 10 : 16 }}>
            <Text style={{ color: textTitle, fontWeight: "800", fontSize: titleSize, textAlign: "center", marginBottom: isSmallScreen ? 8 : 16 }}>Stockeate</Text>
            {err ? (
              <View style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", borderRadius: 8, padding: 12, borderWidth: 1, borderColor: "#ef4444" }}>
                <Text style={{ color: "#ef4444", fontSize: 14, textAlign: "center" }}>{err}</Text>
              </View>
            ) : null}
            <View style={{ gap: isSmallScreen ? 8 : 12 }}>
              <TextInput placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} style={{ backgroundColor: bgInput, color: textInput, borderRadius: 10, padding: inputPadding, fontSize: 16, borderWidth: 1, borderColor: isValidEmail(email) || email === '' ? borderInput : borderError }} placeholderTextColor={textSecondary} autoComplete="email" textContentType="emailAddress" />
              <TextInput placeholder="Contraseña" secureTextEntry value={pass} onChangeText={setPass} style={{ backgroundColor: bgInput, color: textInput, borderRadius: 10, padding: inputPadding, fontSize: 16, borderWidth: 1, borderColor: isValidPassword(pass) || pass === '' ? borderInput : borderError }} placeholderTextColor={textSecondary} autoComplete="password" textContentType="password" />
            </View>
            <View style={{ gap: isSmallScreen ? 8 : 12, marginTop: isSmallScreen ? 8 : 16 }}>
              <TouchableOpacity onPress={() => run(() => login(email.trim(), pass))} style={{ backgroundColor: canSubmit ? "#2563eb" : "#475569", padding: buttonPadding, borderRadius: 10, alignItems: "center", shadowColor: "#2563eb", shadowOffset: { width: 0, height: 2 }, shadowOpacity: canSubmit ? 0.3 : 0, shadowRadius: 4, elevation: canSubmit ? 3 : 0 }} disabled={!canSubmit} activeOpacity={0.8}>
                <Text style={{ color: canSubmit ? "white" : "#94a3b8", fontWeight: "700", fontSize: 16 }}>{loading ? "Ingresando..." : "Ingresar"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => run(() => register(email.trim(), pass))} style={{ backgroundColor: canSubmit ? "#059669" : "#475569", padding: buttonPadding, borderRadius: 10, alignItems: "center", shadowColor: "#059669", shadowOffset: { width: 0, height: 2 }, shadowOpacity: canSubmit ? 0.3 : 0, shadowRadius: 4, elevation: canSubmit ? 3 : 0 }} disabled={!canSubmit} activeOpacity={0.8}>
                <Text style={{ color: canSubmit ? "white" : "#94a3b8", fontWeight: "700", fontSize: 16 }}>{loading ? "Creando..." : "Crear cuenta"}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setShowForgot(true)} style={{ padding: isSmallScreen ? 6 : 10, alignItems: "center", marginTop: isSmallScreen ? 4 : 8 }} activeOpacity={0.7}>
              <Text style={{ color: textSecondary, fontSize: 14 }}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          </View>
          {token ? (
            <View style={{ marginTop: isSmallScreen ? 16 : 24, alignItems: "center", gap: isSmallScreen ? 6 : 10, backgroundColor: "rgba(34, 197, 94, 0.1)", borderRadius: 10, padding: isSmallScreen ? 12 : 16, borderWidth: 1, borderColor: "#22c55e" }}>
              <Text style={{ color: "#22c55e", fontSize: 14, fontWeight: "600" }}>Sesión activa</Text>
              <TouchableOpacity onPress={() => logout()} style={{ backgroundColor: "#dc2626", padding: isSmallScreen ? 8 : 12, borderRadius: 8, shadowColor: "#dc2626", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 }} activeOpacity={0.8}>
                <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>Cerrar sesión</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal visible={showForgot} transparent animationType="fade" onRequestClose={() => setShowForgot(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: containerPadding }}>
            <View style={{ backgroundColor: bgModal, borderRadius: 16, padding: containerPadding, gap: isSmallScreen ? 10 : 14, maxWidth: 400, width: '100%', alignSelf: 'center', borderWidth: 1, borderColor: borderModal }}>
              <Text style={{ color: textTitle, fontWeight: "700", fontSize: 18, textAlign: "center" }}>Recuperar contraseña</Text>
              <TextInput placeholder="Tu email" value={fEmail} onChangeText={setFEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={textSecondary} style={{ backgroundColor: bgInput, color: textInput, borderRadius: 10, padding: inputPadding, fontSize: 16, borderWidth: 1, borderColor: borderInput }} autoComplete="email" />
              <TouchableOpacity onPress={doForgot} style={{ backgroundColor: isValidEmail(fEmail) ? "#2563eb" : "#475569", padding: buttonPadding, borderRadius: 10, alignItems: "center", shadowColor: "#2563eb", shadowOffset: { width: 0, height: 2 }, shadowOpacity: isValidEmail(fEmail) ? 0.3 : 0, shadowRadius: 4, elevation: isValidEmail(fEmail) ? 3 : 0 }} disabled={fSending || !isValidEmail(fEmail)} activeOpacity={0.8}>
                {fSending ? <ActivityIndicator color="white" /> : <Text style={{ color: isValidEmail(fEmail) ? "white" : "#94a3b8", fontWeight: "700" }}>Enviar código</Text>}
              </TouchableOpacity>
              {fSent ? (
                <View style={{ gap: isSmallScreen ? 8 : 10, backgroundColor: "rgba(34, 197, 94, 0.1)", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#22c55e" }}>
                  <Text style={{ color: "#22c55e", fontSize: 13, textAlign: "center" }}>Te enviamos un código de 6 dígitos por email. Ingresalo para cambiar tu contraseña.</Text>
                  <TouchableOpacity onPress={() => { setShowReset(true); }} style={{ backgroundColor: "#059669", padding: 10, borderRadius: 8, alignItems: "center" }} activeOpacity={0.8}>
                    <Text style={{ color: "white", fontWeight: "600" }}>Tengo el código</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <TouchableOpacity onPress={() => setShowForgot(false)} style={{ padding: 8, alignItems: "center" }} activeOpacity={0.7}>
                <Text style={{ color: textSecondary }}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    <Modal visible={showReset} transparent animationType="fade" onRequestClose={() => setShowReset(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: containerPadding }}>
            <View style={{ backgroundColor: bgModal, borderRadius: 16, padding: containerPadding, gap: isSmallScreen ? 10 : 14, maxWidth: 400, width: '100%', alignSelf: 'center', borderWidth: 1, borderColor: borderModal }}>
              <Text style={{ color: textTitle, fontWeight: "700", fontSize: 18, textAlign: "center" }}>Cambiar contraseña</Text>
              <TextInput placeholder="Código de 6 dígitos" value={rToken} onChangeText={(text) => setRToken(text.replace(/[^0-9]/g, '').slice(0, 6))} autoCapitalize="none" keyboardType="number-pad" placeholderTextColor={textSecondary} style={{ backgroundColor: bgInput, color: textInput, borderRadius: 10, padding: inputPadding, fontSize: 16, borderWidth: 1, borderColor: rToken.length === 6 ? "#22c55e" : borderInput, textAlign: "center", letterSpacing: 2 }} maxLength={6} />
              <TextInput placeholder="Nueva contraseña" value={rPass} onChangeText={setRPass} secureTextEntry placeholderTextColor={textSecondary} style={{ backgroundColor: bgInput, color: textInput, borderRadius: 10, padding: inputPadding, fontSize: 16, borderWidth: 1, borderColor: isValidPassword(rPass) || rPass === '' ? borderInput : borderError }} autoComplete="new-password" textContentType="newPassword" />
              {rMsg ? (
                <View style={{ backgroundColor: rMsg.includes('Error') ? "rgba(239, 68, 68, 0.1)" : "rgba(34, 197, 94, 0.1)", borderRadius: 8, padding: 12, borderWidth: 1, borderColor: rMsg.includes('Error') ? "#ef4444" : "#22c55e" }}>
                  <Text style={{ color: rMsg.includes('Error') ? "#ef4444" : "#22c55e", textAlign: "center", fontSize: 13 }}>{rMsg}</Text>
                </View>
              ) : null}
              <TouchableOpacity onPress={doReset} style={{ backgroundColor: (rToken.length === 6 && isValidPassword(rPass)) ? "#2563eb" : "#475569", padding: buttonPadding, borderRadius: 10, alignItems: "center", shadowColor: "#2563eb", shadowOffset: { width: 0, height: 2 }, shadowOpacity: (rToken.length === 6 && isValidPassword(rPass)) ? 0.3 : 0, shadowRadius: 4, elevation: (rToken.length === 6 && isValidPassword(rPass)) ? 3 : 0 }} disabled={rLoading || rToken.length !== 6 || !isValidPassword(rPass)} activeOpacity={0.8}>
                {rLoading ? <ActivityIndicator color="white" /> : <Text style={{ color: (rToken.length === 6 && isValidPassword(rPass)) ? "white" : "#94a3b8", fontWeight: "700" }}>Cambiar</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowReset(false)} style={{ padding: 8, alignItems: "center" }} activeOpacity={0.7}>
                <Text style={{ color: textSecondary }}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
