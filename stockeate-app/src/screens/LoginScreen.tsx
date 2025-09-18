import React, { useState } from "react";
import { View, TextInput, Text, TouchableOpacity, Modal, ActivityIndicator } from "react-native";
import { useAuth } from "../stores/auth";
import { api } from "../api";

export default function LoginScreen() {
  const { login, register, logout, token } = useAuth();

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Forgot & Reset
  const [showForgot, setShowForgot] = useState(false);
  const [fEmail, setFEmail] = useState("");
  const [fSending, setFSending] = useState(false);
  const [fSent, setFSent] = useState(false);

  const [showReset, setShowReset] = useState(false);
  const [rToken, setRToken] = useState(""); // código de 6 dígitos
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
      setFSent(true); // email enviado
    } catch {
      // igual mostramos "enviado" para no filtrar si existe o no
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

  return (
    <View style={{ flex: 1, backgroundColor: "#0b1220", padding: 16, gap: 12, justifyContent: "center" }}>
      <Text style={{ color: "white", fontWeight: "800", fontSize: 22, textAlign: "center", marginBottom: 12 }}>
        Stockeate
      </Text>

      {err ? (
        <Text style={{ color: "#ff7b7b", fontSize: 14, textAlign: "center" }}>{err}</Text>
      ) : null}

      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{ backgroundColor: "#121a2b", color: "white", borderRadius: 8, padding: 12 }}
        placeholderTextColor="#9aa4b2"
      />
      <TextInput
        placeholder="Contraseña"
        secureTextEntry
        value={pass}
        onChangeText={setPass}
        style={{ backgroundColor: "#121a2b", color: "white", borderRadius: 8, padding: 12 }}
        placeholderTextColor="#9aa4b2"
      />

      <TouchableOpacity
        onPress={() => run(() => login(email.trim(), pass))}
        style={{ backgroundColor: "#2b68ff", padding: 12, borderRadius: 8, alignItems: "center" }}
        disabled={loading}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>
          {loading ? "Ingresando..." : "Ingresar"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => run(() => register(email.trim(), pass))}
        style={{ backgroundColor: "#1e293b", padding: 12, borderRadius: 8, alignItems: "center" }}
        disabled={loading}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>
          {loading ? "Creando..." : "Crear cuenta"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setShowForgot(true)} style={{ padding: 8, alignItems: "center" }}>
        <Text style={{ color: "#94a3b8" }}>¿Olvidaste tu contraseña?</Text>
      </TouchableOpacity>

      {token ? (
        <View style={{ marginTop: 24, alignItems: "center", gap: 8 }}>
          <Text style={{ color: "#9aa4b2" }}>Sesión activa</Text>
          <TouchableOpacity
            onPress={() => logout()}
            style={{ backgroundColor: "#ef4444", padding: 10, borderRadius: 8 }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Modal Forgot */}
      <Modal visible={showForgot} transparent animationType="fade" onRequestClose={() => setShowForgot(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 16 }}>
          <View style={{ backgroundColor: "#0b1220", borderRadius: 12, padding: 16, gap: 12 }}>
            <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>Recuperar contraseña</Text>
            <TextInput
              placeholder="Tu email"
              value={fEmail}
              onChangeText={setFEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#9aa4b2"
              style={{ backgroundColor: "#121a2b", color: "white", borderRadius: 8, padding: 12 }}
            />
            <TouchableOpacity
              onPress={doForgot}
              style={{ backgroundColor: "#2b68ff", padding: 12, borderRadius: 8, alignItems: "center" }}
              disabled={fSending}
            >
              {fSending ? <ActivityIndicator color="white" /> : <Text style={{ color: "white", fontWeight: "700" }}>Enviar código</Text>}
            </TouchableOpacity>

            {fSent ? (
              <View style={{ gap: 6 }}>
                <Text style={{ color: "#9aa4b2", fontSize: 12 }}>
                  Te enviamos un código de 6 dígitos por email. Ingresalo para cambiar tu contraseña.
                </Text>
                <TouchableOpacity
                  onPress={() => { setShowReset(true); }}
                  style={{ backgroundColor: "#1e293b", padding: 10, borderRadius: 8, alignItems: "center" }}
                >
                  <Text style={{ color: "white" }}>Tengo el código</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <TouchableOpacity onPress={() => setShowForgot(false)} style={{ padding: 8, alignItems: "center" }}>
              <Text style={{ color: "#94a3b8" }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Reset */}
      <Modal visible={showReset} transparent animationType="fade" onRequestClose={() => setShowReset(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 16 }}>
          <View style={{ backgroundColor: "#0b1220", borderRadius: 12, padding: 16, gap: 12 }}>
            <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>Cambiar contraseña</Text>
            <TextInput
              placeholder="Código de 6 dígitos"
              value={rToken}
              onChangeText={setRToken}
              autoCapitalize="none"
              keyboardType="number-pad"
              placeholderTextColor="#9aa4b2"
              style={{ backgroundColor: "#121a2b", color: "white", borderRadius: 8, padding: 12 }}
            />
            <TextInput
              placeholder="Nueva contraseña"
              value={rPass}
              onChangeText={setRPass}
              secureTextEntry
              placeholderTextColor="#9aa4b2"
              style={{ backgroundColor: "#121a2b", color: "white", borderRadius: 8, padding: 12 }}
            />
            {rMsg ? <Text style={{ color: "#93c5fd" }}>{rMsg}</Text> : null}
            <TouchableOpacity
              onPress={doReset}
              style={{ backgroundColor: "#2b68ff", padding: 12, borderRadius: 8, alignItems: "center" }}
              disabled={rLoading}
            >
              {rLoading ? <ActivityIndicator color="white" /> : <Text style={{ color: "white", fontWeight: "700" }}>Cambiar</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowReset(false)} style={{ padding: 8, alignItems: "center" }}>
              <Text style={{ color: "#94a3b8" }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
