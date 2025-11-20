// src/screens/LoginScreen.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAuth } from "../stores/auth";
import { api } from "../api";

// Logo (ruta según tu proyecto)
import Logo from "../../assets/images/login.png";

const schema = z.object({
  email: z
    .string()
    .min(1, "Ingresá tu email")
    .email("Formato de email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});
type FormData = z.infer<typeof schema>;

export default function LoginScreen({ navigation }: any) {
  const { login, register, logout, token } = useAuth();

  // ===== Estado original preservado =====
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState(false);
  const [fEmail, setFEmail] = useState("");
  const [fSending, setFSending] = useState(false);
  const [fSent, setFSent] = useState(false);

  const [showReset, setShowReset] = useState(false);
  const [rToken, setRToken] = useState(""); // código de 6 dígitos
  const [rPass, setRPass] = useState("");
  const [rLoading, setRLoading] = useState(false);
  const [rMsg, setRMsg] = useState<string | null>(null);

  // ===== Nuevo: RHF + Zod (sin romper tu lógica) =====
  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  // Sync con tus states por compatibilidad (opcional)
  const syncEmail = (v: string) => {
    setEmail(v);
    setValue("email", v, { shouldValidate: false });
  };
  const syncPass = (v: string) => {
    setPass(v);
    setValue("password", v, { shouldValidate: false });
  };

  // ===== Helper run original =====
  const run = async (fn: () => Promise<void>) => {
    setErr(null);
    setLoginLoading(true);
    try {
      await fn();
    } catch (e: any) {
      const d = e?.response?.data;
      const msg = Array.isArray(d?.message)
        ? d.message.join(", ")
        : d?.message || e?.message || "Error";
      setErr(msg);
    } finally {
      setLoginLoading(false);
    }
  };

  // ===== Flujos forgot / reset originales =====
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
      await api.post("/auth/reset", {
        token: rToken.trim(),
        newPassword: rPass,
      });
      setRMsg("Contraseña actualizada. Ahora podés iniciar sesión.");
      setShowReset(false);
      setShowForgot(false);
      setRPass("");
      setRToken("");
    } catch (e: any) {
      const d = e?.response?.data;
      const msg = Array.isArray(d?.message)
        ? d.message.join(", ")
        : d?.message || e?.message || "Error";
      setRMsg(msg);
    } finally {
      setRLoading(false);
    }
  };

  const [secure, setSecure] = useState(true);
  const c = {
    bg1: "#0F1020",
    bg2: "#0A0B14",
    accent: "#4C6FFF",
    accent2: "#8B5CF6",
    text: "#E6E8F2",
    sub: "rgba(230,232,242,0.7)",
    cardBg: "rgba(255,255,255,0.06)",
    cardBorder: "rgba(255,255,255,0.12)",
    danger: "#FF6B6B",
  };

  const onSubmit = async (data: FormData) => {
    await run(() => login(data.email.trim(), data.password));
  };

  // ===== Animación del logo: fade + escala =====
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  return (
    <LinearGradient colors={[c.bg1, c.bg2]} style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: "padding", android: undefined })}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: 20,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Branding con LOGO animado */}
          <View style={{ marginBottom: 24, alignItems: "center" }}>
            <Animated.View
              style={{
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              }}
            >
              <Image
                source={Logo}
                style={{ width: 90, height: 90, resizeMode: "contain" }}
                accessible
                accessibilityLabel="Logo de Stockeate"
              />
            </Animated.View>
            <Text
              style={{
                color: c.text,
                fontSize: 28,
                fontWeight: "800",
                marginTop: 14,
              }}
            >
              Stockeate
            </Text>
            <Text style={{ color: c.sub, marginTop: 4 }}>
              Acceso a tu inventario
            </Text>
          </View>

          {/* Card */}
          <View
            style={{
              borderRadius: 20,
              backgroundColor: c.cardBg,
              padding: 18,
              borderWidth: 1,
              borderColor: c.cardBorder,
              shadowColor: "#000",
              shadowOpacity: 0.25,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 8 },
              elevation: 12,
            }}
          >
            {/* Error general */}
            {err ? (
              <Text
                style={{
                  color: c.danger,
                  fontSize: 13,
                  textAlign: "center",
                  marginBottom: 8,
                }}
              >
                {err}
              </Text>
            ) : null}

            {/* Email */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ color: c.sub, marginBottom: 8, fontSize: 12 }}>
                Email
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  borderWidth: 1,
                  borderColor: errors.email
                    ? c.danger
                    : "rgba(255,255,255,0.12)",
                  borderRadius: 14,
                  paddingHorizontal: 12,
                }}
              >
                <Ionicons name="mail-outline" size={18} color={c.sub} />
                <Controller
                  control={control}
                  name="email"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={{
                        flex: 1,
                        color: c.text,
                        paddingVertical: 12,
                        paddingHorizontal: 10,
                      }}
                      placeholder="tu@email.com"
                      placeholderTextColor="rgba(230,232,242,0.35)"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      autoComplete="email"
                      onBlur={onBlur}
                      onChangeText={(v) => {
                        onChange(v);
                        syncEmail(v);
                      }}
                      value={value}
                      returnKeyType="next"
                    />
                  )}
                />
              </View>
              {errors.email && (
                <Text style={{ color: c.danger, marginTop: 6, fontSize: 12 }}>
                  {errors.email.message}
                </Text>
              )}
            </View>

            {/* Password */}
            <View style={{ marginBottom: 6 }}>
              <Text style={{ color: c.sub, marginBottom: 8, fontSize: 12 }}>
                Contraseña
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  borderWidth: 1,
                  borderColor: errors.password
                    ? c.danger
                    : "rgba(255,255,255,0.12)",
                  borderRadius: 14,
                  paddingHorizontal: 12,
                }}
              >
                <Ionicons name="lock-closed-outline" size={18} color={c.sub} />
                <Controller
                  control={control}
                  name="password"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={{
                        flex: 1,
                        color: c.text,
                        paddingVertical: 12,
                        paddingHorizontal: 10,
                      }}
                      placeholder="••••••••"
                      placeholderTextColor="rgba(230,232,242,0.35)"
                      secureTextEntry={secure}
                      textContentType="password"
                      autoComplete="password"
                      onBlur={onBlur}
                      onChangeText={(v) => {
                        onChange(v);
                        syncPass(v);
                      }}
                      value={value}
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit(onSubmit)}
                    />
                  )}
                />
                <TouchableOpacity onPress={() => setSecure((s) => !s)}>
                  <Ionicons
                    name={secure ? "eye-outline" : "eye-off-outline"}
                    size={18}
                    color={c.sub}
                  />
                </TouchableOpacity>
              </View>
              {errors.password && (
                <Text style={{ color: c.danger, marginTop: 6, fontSize: 12 }}>
                  {errors.password.message}
                </Text>
              )}
            </View>

            {/* Forgot */}
            <TouchableOpacity
              onPress={() => setShowForgot(true)}
              style={{ alignSelf: "flex-end", paddingVertical: 8 }}
            >
              <Text
                style={{
                  color: c.sub,
                  fontSize: 12,
                  textDecorationLine: "underline",
                }}
              >
                ¿Olvidaste tu contraseña?
              </Text>
            </TouchableOpacity>

            {/* Ingresar */}
            <TouchableOpacity
              onPress={handleSubmit(onSubmit)}
              disabled={loginLoading}
              style={{ marginTop: 4, borderRadius: 14, overflow: "hidden" }}
            >
              <LinearGradient
                colors={[c.accent, c.accent2]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingVertical: 14,
                  alignItems: "center",
                  opacity: loginLoading ? 0.7 : 1,
                }}
              >
                {loginLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "700" }}>
                    Ingresar
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Crear cuenta */}
            <TouchableOpacity
              onPress={() => navigation.navigate("Register")}
              disabled={loginLoading}
              style={{
                marginTop: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
                backgroundColor: "rgba(255,255,255,0.04)",
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ color: c.text, fontWeight: "600" }}>
                Crear cuenta
              </Text>
            </TouchableOpacity>

            {/* Sesión activa */}
            {token ? (
              <View style={{ marginTop: 16, alignItems: "center", gap: 8 }}>
                <Text style={{ color: c.sub }}>Sesión activa</Text>
                <TouchableOpacity
                  onPress={() => logout()}
                  style={{
                    backgroundColor: "#ef4444",
                    padding: 10,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "700" }}>
                    Cerrar sesión
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {/* Footer */}
          <View style={{ marginTop: 16, alignItems: "center" }}>
            <Text style={{ color: c.sub, fontSize: 12 }}>
              © {new Date().getFullYear()} Stockeate
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal Forgot */}
      <Modal
        visible={showForgot}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForgot(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <View
            style={{
              backgroundColor: "#0b1220",
              borderRadius: 16,
              padding: 16,
              gap: 12,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
            }}
          >
            <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
              Recuperar contraseña
            </Text>
            <TextInput
              placeholder="Tu email"
              value={fEmail}
              onChangeText={setFEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#9aa4b2"
              style={{
                backgroundColor: "#121a2b",
                color: "white",
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
              }}
            />
            <TouchableOpacity
              onPress={doForgot}
              style={{
                backgroundColor: "#2b68ff",
                padding: 12,
                borderRadius: 12,
                alignItems: "center",
              }}
              disabled={fSending}
            >
              {fSending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ color: "white", fontWeight: "700" }}>
                  Enviar código
                </Text>
              )}
            </TouchableOpacity>

            {fSent ? (
              <View style={{ gap: 6 }}>
                <Text style={{ color: "#9aa4b2", fontSize: 12 }}>
                  Te enviamos un código de 6 dígitos por email. Ingresalo para
                  cambiar tu contraseña.
                </Text>
                <TouchableOpacity
                  onPress={() => setShowReset(true)}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.06)",
                    padding: 10,
                    borderRadius: 10,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.12)",
                  }}
                >
                  <Text style={{ color: "white" }}>Tengo el código</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={() => setShowForgot(false)}
              style={{ padding: 8, alignItems: "center" }}
            >
              <Text style={{ color: "#94a3b8" }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Reset */}
      <Modal
        visible={showReset}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReset(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <View
            style={{
              backgroundColor: "#0b1220",
              borderRadius: 16,
              padding: 16,
              gap: 12,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
            }}
          >
            <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
              Cambiar contraseña
            </Text>
            <TextInput
              placeholder="Código de 6 dígitos"
              value={rToken}
              onChangeText={setRToken}
              autoCapitalize="none"
              keyboardType="number-pad"
              placeholderTextColor="#9aa4b2"
              style={{
                backgroundColor: "#121a2b",
                color: "white",
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
              }}
            />
            <TextInput
              placeholder="Nueva contraseña"
              value={rPass}
              onChangeText={setRPass}
              secureTextEntry
              placeholderTextColor="#9aa4b2"
              style={{
                backgroundColor: "#121a2b",
                color: "white",
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
              }}
            />
            {rMsg ? <Text style={{ color: "#93c5fd" }}>{rMsg}</Text> : null}
            <TouchableOpacity
              onPress={doReset}
              style={{
                backgroundColor: "#2b68ff",
                padding: 12,
                borderRadius: 12,
                alignItems: "center",
              }}
              disabled={rLoading}
            >
              {rLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ color: "white", fontWeight: "700" }}>
                  Cambiar
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowReset(false)}
              style={{ padding: 8, alignItems: "center" }}
            >
              <Text style={{ color: "#94a3b8" }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}
