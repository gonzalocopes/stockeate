// src/screens/BranchSelect.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api";
import { useBranch } from "../stores/branch";
import { useAuth } from "../stores/auth";
import { pullBranchCatalog } from "../sync/index";
import { useThemeStore } from "../stores/themeProviders";

import HamburgerMenu from "../components/HamburgerMenu";

type Branch = {
  id: string;
  name: string;
  address?: string;
  online?: boolean;
};

export default function BranchSelect({ navigation }: any) {
  const { theme } = useThemeStore();
  const { logout, user } = useAuth();
  const setBranch = useBranch((s) => s.set);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [sel, setSel] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const [branchStatus, setBranchStatus] = useState<Record<string, boolean>>({});
  const [menuOpen, setMenuOpen] = useState(false);

  const isWithinOperatingHours = () => {
    const now = new Date();
    const buenosAiresTime = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const hours = buenosAiresTime.getUTCHours();
    return hours >= 8 && hours < 20;
  };

  useEffect(() => {
    const checkOperatingHours = () => {
      const isOpen = isWithinOperatingHours();
      setBranchStatus((current) => {
        const newStatus = { ...current };
        branches.forEach((branch) => {
          newStatus[branch.id] = isOpen;
        });
        return newStatus;
      });
    };
    checkOperatingHours();
    const interval = setInterval(checkOperatingHours, 60000);
    return () => clearInterval(interval);
  }, [branches]);

  // Header del Stack con botón hamburguesa (sin círculo)
  useEffect(() => {
    navigation.setOptions({
      headerTitle: "Elegir sucursal",
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setMenuOpen(true)}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          style={{ paddingHorizontal: 6, paddingVertical: 6 }} // 👈 sin fondo ni borde
          accessibilityLabel="Abrir menú"
          accessibilityRole="button"
        >
          <Ionicons
            name="menu"
            size={22}
            color={(theme as any)?.colors?.headerIcon ?? theme.colors.text}
          />
        </TouchableOpacity>
      ),
      headerStyle: {
        backgroundColor: theme.colors.header ?? theme.colors.background,
      },
      headerTitleStyle: { color: theme.colors.text },
      headerTintColor: theme.colors.text,
      headerTitleAlign: "center",
    });
  }, [navigation, theme]);

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        setLoading(true);
        const { data } = await api.get<Branch[]>("/branches");

        const additionalBranches: Branch[] = [
          {
            id: "norte",
            name: "Depósito Norte",
            address: "Av. Maipú 2854, Olivos, Buenos Aires",
          },
          {
            id: "sur",
            name: "Depósito Sur",
            address: "Av. Hipólito Yrigoyen 13205, Adrogué, Buenos Aires",
          },
        ];

        const allBranches = [...data, ...additionalBranches];
        setBranches(allBranches);

        const initialStatus: Record<string, boolean> = {};
        const isOpen = isWithinOperatingHours();
        allBranches.forEach((branch) => {
          initialStatus[branch.id] = isOpen;
        });
        setBranchStatus(initialStatus);

        setSel(null);
      } catch (e: any) {
        console.error("BRANCHES_FAIL", e?.response?.data || e?.message || e);
        const d = e?.response?.data;
        const msg = Array.isArray(d?.message)
          ? d.message.join(", ")
          : d?.message || e?.message || "No pude cargar sucursales";
        setErr(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigation]);

  const renderItem = ({ item }: { item: Branch }) => (
    <TouchableOpacity
      onPress={() => (sel?.id === item.id ? setSel(null) : setSel(item))}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor:
          sel && sel.id === item.id ? theme.colors.primary : theme.colors.border,
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        marginHorizontal: 4,
        backgroundColor: theme.colors.card,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      }}
      activeOpacity={0.7}
    >
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1, minHeight: 50 }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor:
              sel && sel.id === item.id ? theme.colors.primary : theme.colors.inputBorder,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Text
            style={{
              color: sel && sel.id === item.id ? "#fff" : theme.colors.textMuted,
              fontSize: 14,
              marginTop: -1,
            }}
          >
            ✓
          </Text>
        </View>

        <View style={{ flex: 1, marginRight: 8 }}>
          <Text
            style={{ fontSize: 17, fontWeight: "600", color: theme.colors.text, marginBottom: 4 }}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text
            style={{ fontSize: 14, color: theme.colors.textMuted, lineHeight: 18 }}
            numberOfLines={2}
          >
            {item.address || "Av. Hipólito Yrigoyen 20260, B1856 Glew, Provincia de Buenos Aires"}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: branchStatus[item.id] ? theme.colors.success : theme.colors.danger,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 10,
            alignSelf: "flex-start",
            marginTop: 2,
            opacity: 0.8,
          }}
        >
          <Text style={{ color: "white", fontSize: 12, fontWeight: "500" }}>
            {branchStatus[item.id] ? "Abierto" : "Cerrado"}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const onContinue = async () => {
    if (!sel || syncing) return;
    setSyncing(true);
    try {
      await setBranch(sel.id, sel.name);
      await pullBranchCatalog(sel.id);
    } catch (e) {
      console.log("SYNC_BRANCH_CATALOG_FAIL", e);
    } finally {
      setSyncing(false);
      navigation.replace("Home");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ flex: 1, padding: 16, paddingTop: 32 }}>
        {loading && (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 20 }} />
        )}
        {err ? (
          <Text style={{ color: theme.colors.danger, marginBottom: 8, textAlign: "center" }}>
            {err}
          </Text>
        ) : null}

        {!loading && !err && branches.length === 0 ? (
          <Text style={{ textAlign: "center", color: theme.colors.text }}>
            No hay sucursales.
          </Text>
        ) : (
          <FlatList
            data={branches}
            keyExtractor={(i, idx) => (i?.id ? i.id : String(idx))}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 8, paddingTop: "6%", paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: theme.colors.inputBackground,
          paddingHorizontal: 16,
          paddingBottom: 16,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
        }}
      >
        <TouchableOpacity
          style={{
            backgroundColor: sel ? theme.colors.primary : theme.colors.neutral,
            paddingVertical: 16,
            borderRadius: 8,
            alignItems: "center",
            opacity: syncing ? 0.85 : 1,
          }}
          onPress={onContinue}
          activeOpacity={0.8}
          disabled={!sel || syncing}
        >
          {syncing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text
              numberOfLines={2}
              ellipsizeMode="tail"
              style={{
                color: "white",
                fontWeight: "600",
                fontSize: 16,
                opacity: sel ? 1 : 0.7,
                textAlign: "center",
                flexShrink: 1,
              }}
            >
              {sel ? `Continuar con ${sel.name}` : "Seleccioná una sucursal"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <HamburgerMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        navigation={navigation}
        userName={user?.name}
        userEmail={user?.email}
        items={[
          { label: "Configuración", onPress: () => navigation.navigate("Settings") },
          { label: "Cerrar sesión", onPress: logout, isDestructive: true },
        ]}
      />
    </View>
  );
}
