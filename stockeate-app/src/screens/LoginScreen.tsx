import React, { useState } from "react";
import { View, TextInput, Text, TouchableOpacity } from "react-native";
import { useAuth } from "../stores/auth";

export default function LoginScreen() {
  const { login, register, logout, token } = useAuth();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setErr(null);
    setLoading(true);
    try {
      await fn();
    } catch (e: any) {
      setErr(e?.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 16, gap: 8 }}>
      <Text style={{ fontSize: 18, fontWeight: "600" }}>Acceso</Text>

      <TextInput
        style={{
          borderWidth: 1,
          borderColor: email ? "#007AFF" : "#ddd",
          borderRadius: 8,
          padding: 8,
          backgroundColor: email ? "#f8f9ff" : "white",
        }}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: pass ? "#007AFF" : "#ddd",
          borderRadius: 8,
          padding: 8,
          backgroundColor: pass ? "#f8f9ff" : "white",
        }}
        value={pass}
        onChangeText={setPass}
        placeholder="Contraseña"
        secureTextEntry
      />

      {err ? <Text style={{ color: "red" }}>{err}</Text> : null}

      <TouchableOpacity
        style={{
          backgroundColor: !loading && email && pass ? "#007AFF" : "#6c757d",
          paddingVertical: 12,
          borderRadius: 8,
          alignItems: "center",
          marginTop: 8,
        }}
        onPress={() => run(() => login(email, pass))}
        activeOpacity={0.8}
        disabled={loading || !email || !pass}
      >
        <Text
          style={{
            color: "white",
            fontWeight: "600",
            fontSize: 16,
            opacity: !loading && email && pass ? 1 : 0.7,
          }}
        >
          {loading ? "Procesando..." : "INGRESAR"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{
          backgroundColor: !loading && email && pass ? "#28a745" : "#6c757d",
          paddingVertical: 12,
          borderRadius: 8,
          alignItems: "center",
          marginTop: 8,
        }}
        onPress={() => run(() => register(email, pass))}
        activeOpacity={0.8}
        disabled={loading || !email || !pass}
      >
        <Text
          style={{
            color: "white",
            fontWeight: "600",
            fontSize: 16,
            opacity: !loading && email && pass ? 1 : 0.7,
          }}
        >
          {loading ? "Procesando..." : "REGISTRARME"}
        </Text>
      </TouchableOpacity>

      {token ? (
        <View style={{ marginTop: 16 }}>
          <TouchableOpacity
            style={{
              backgroundColor: "#dc3545",
              paddingVertical: 10,
              borderRadius: 8,
              alignItems: "center",
            }}
            onPress={() => run(logout)}
            activeOpacity={0.8}
          >
            <Text
              style={{
                color: "white",
                fontWeight: "600",
                fontSize: 14,
              }}
            >
              Cerrar sesión
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
