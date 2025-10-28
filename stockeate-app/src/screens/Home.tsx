// src/screens/Home.tsx
import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { useAuth } from "../stores/auth";

export default function Home({ navigation }: any) {
  const logout = useAuth((s) => s.logout);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate("BranchSelect")}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            marginLeft: 0,
          }}
          activeOpacity={0.8}
        >
          <Image
            source={require("../../node_modules/@react-navigation/elements/lib/module/assets/back-icon.png")}
            style={{ width: 24, height: 24, tintColor: "#1c1c1e" }}
          />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={logout}
          style={{
            backgroundColor: "rgb(195 12 12)",
            borderRadius: 11,
            paddingHorizontal: 16,
            paddingVertical: 8,
            marginRight: 4,
          }}
          activeOpacity={0.8}
        >
          <Text style={{ color: "rgb(255, 255, 255)", fontWeight: "600" }}>
            Cerrar sesión
          </Text>
        </TouchableOpacity>
      ),
      title: "Menú",
    });
  }, [navigation, logout]);

  return (
    <View style={{ flex: 1, backgroundColor: "#f3f4f6" }}>
      <View style={{ flex: 1, padding: 16, paddingBottom: 90 }}>
        {/* Card de productos con stock bajo */}
        <View
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 12,
            paddingVertical: 16,
            paddingHorizontal: 16,
            marginBottom: 20,
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 5,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                backgroundColor: "#fef3c7",
                borderRadius: 8,
                padding: 8,
                marginRight: 12,
              }}
            >
              <Text style={{ fontSize: 20, padding: 6 }}>⚠️</Text>
            </View>
            <Text style={{ color: "#374151", fontSize: 14, fontWeight: "500" }}>
              Productos con stock bajo:
            </Text>
          </View>
          <Text style={{ color: "#111827", fontSize: 32, fontWeight: "700" }}>
            2
          </Text>
        </View>

        {/* Grilla 2x2 */}
        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: "row", gap: 16 }}>
            {/* Escanear */}
            <TouchableOpacity
              style={{
                flex: 1,
                height: 140,
                backgroundColor: "#10b981",
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#000",
                shadowOpacity: 0.15,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 4,
                transform: [{ scale: 1 }],
              }}
              onPress={() => navigation.navigate("ScanAdd")}
              activeOpacity={0.7}
              pressRetentionOffset={{
                top: 10,
                left: 10,
                right: 10,
                bottom: 10,
              }}
            >
              <View
                style={{
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: "#ffffff", fontSize: 32 }}>📷</Text>
              </View>
              <Text
                style={{ color: "#ffffff", fontSize: 16, fontWeight: "600" }}
              >
                Escanear
              </Text>
            </TouchableOpacity>

            {/* Crear Remito */}
            <TouchableOpacity
              style={{
                flex: 1,
                height: 140,
                backgroundColor: "#3b82f6",
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#000",
                shadowOpacity: 0.15,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 4,
                transform: [{ scale: 1 }],
              }}
              onPress={() => navigation.navigate("RemitosHub")}
              activeOpacity={0.7}
              pressRetentionOffset={{
                top: 10,
                left: 10,
                right: 10,
                bottom: 10,
              }}
            >
              <View
                style={{
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: "#ffffff", fontSize: 32 }}>📄</Text>
              </View>
              <Text
                style={{ color: "#ffffff", fontSize: 16, fontWeight: "600" }}
              >
                Crear Remito
              </Text>
            </TouchableOpacity>
          </View>

          {/* Ver Inventario (ancho completo) */}
          <TouchableOpacity
            style={{
              width: "100%",
              height: 140,
              backgroundColor: "#6b7280",
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
              transform: [{ scale: 1 }],
            }}
            onPress={() => navigation.navigate("BranchProducts")}
            activeOpacity={0.7}
            pressRetentionOffset={{ top: 10, left: 10, right: 10, bottom: 10 }}
          >
            <View
              style={{
                borderRadius: 12,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <Text style={{ color: "#ffffff", fontSize: 32 }}>🔍</Text>
            </View>
            <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "600" }}>
              Ver Inventario
            </Text>
          </TouchableOpacity>

          {/* Transferir Stock (comentado)
          <TouchableOpacity
            style={{
              flex: 1,
              height: 140,
              backgroundColor: "#10b981",
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            }}
            onPress={() => navigation.navigate("RemitosHub")}
            activeOpacity={0.8}
          >
            <View
              style={{
                
                borderRadius: 12,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <Text style={{ color: "#ffffff", fontSize: 32 }}>↔️</Text>
            </View>
            <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "600" }}>Transferir Stock</Text>
          </TouchableOpacity>
          */}
        </View>
      </View>

      {/* Footer hardcodeado */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 70,
          backgroundColor: "#ffffff",
          borderTopWidth: 1,
          borderTopColor: "#e5e7eb",
          flexDirection: "row",
          justifyContent: "space-evenly",
          alignItems: "center",
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: -2 },
          elevation: 8,
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.navigate("Home")}
          style={{ alignItems: "center", gap: 4 }}
          activeOpacity={0.6}
        >
          <View
            style={{
              backgroundColor: "#f3f4f6",
              borderRadius: 8,
              padding: 6,
            }}
          >
            <Text style={{ fontSize: 18, color: "#6b7280" }}>🏠</Text>
          </View>
          <Text style={{ color: "#6b7280", fontWeight: "600", fontSize: 12 }}>
            Menú
          </Text>
        </TouchableOpacity>
        <View style={{ alignItems: "center", gap: 4 }}>
          <View
            style={{
              backgroundColor: "#f3f4f6",
              borderRadius: 8,
              padding: 6,
            }}
          >
            <Text style={{ fontSize: 18, color: "#6b7280" }}>👤</Text>
          </View>
          <Text style={{ color: "#6b7280", fontWeight: "600", fontSize: 12 }}>
            Perfil
          </Text>
        </View>
      </View>
    </View>
  );
}
