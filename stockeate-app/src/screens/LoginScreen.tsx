import React, { useState } from "react";
import { View, TextInput, Button, Text } from "react-native";
import { useAuth } from "../stores/auth";

export default function LoginScreen() {
  const { login, register, logout, token } = useAuth();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setErr(null); setLoading(true);
    try { await fn(); }
    catch (e: any) { setErr(e?.message || "Error inesperado"); }
    finally { setLoading(false); }
  };

  return (
    <View style={{ padding: 16, gap: 8 }}>
      <Text style={{ fontSize: 18, fontWeight: "600" }}>Acceso</Text>

      <TextInput
        style={{ borderWidth: 1, borderRadius: 8, padding: 8 }}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={{ borderWidth: 1, borderRadius: 8, padding: 8 }}
        value={pass}
        onChangeText={setPass}
        placeholder="Contraseña"
        secureTextEntry
      />

      {err ? <Text style={{ color: "red" }}>{err}</Text> : null}

      <Button
        title={loading ? "Procesando..." : "INGRESAR"}
        disabled={loading || !email || !pass}
        onPress={() => run(() => login(email, pass))}
      />
      <Button
        title={loading ? "Procesando..." : "REGISTRARME"}
        disabled={loading || !email || !pass}
        onPress={() => run(() => register(email, pass))}
      />

      {token ? (
        <View style={{ marginTop: 8 }}>
          <Button title="Cerrar sesión (borrar token)" onPress={() => run(logout)} />
        </View>
      ) : null}
    </View>
  );
}
