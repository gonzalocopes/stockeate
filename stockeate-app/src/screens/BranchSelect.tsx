// src/screens\BranchSelect.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { api } from "../api";
import { useBranch } from "../stores/branch";
import { useAuth } from "../stores/auth";
import { pullBranchCatalog } from "../sync/index";

import { useThemeStore } from "../stores/themeProviders"; // 👈 Importar el store del tema

type Branch = {
  id: string;
  name: string;
  address?: string; // dirección de la sucursal
  online?: boolean; // estado de conexión
};

export default function BranchSelect({ navigation }: any) {
  const { theme } = useThemeStore(); // 👈 Obtener el tema
  const setBranch = useBranch((s) => s.set);
  const logout = useAuth((s) => s.logout);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [sel, setSel] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Estado para almacenar el estado online/offline de las sucursales
  const [branchStatus, setBranchStatus] = useState<Record<string, boolean>>({});

  // Función para verificar si está dentro del horario de operación (8:00 a 20:00)
  const isWithinOperatingHours = () => {
    const now = new Date();
    // Configurar la hora en GMT-3 (Buenos Aires)
    const buenosAiresTime = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const hours = buenosAiresTime.getUTCHours();
    return hours >= 8 && hours < 20;
  };

  // Actualizar estado basado en horario
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

    // Verificar inmediatamente
    checkOperatingHours();

    // Actualizar cada minuto
    const interval = setInterval(checkOperatingHours, 60000);

    return () => clearInterval(interval);
  }, [branches]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: null,
    });

    (async () => {
      try {
        setErr(null);
        setLoading(true);
        // Llamada real a la API para depósito central
        const { data } = await api.get<Branch[]>("/branches");

        // Agregar depósitos adicionales (vacíos)
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

        // Inicializar estados basados en horario de operación
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
        // Borde primario si está seleccionado, borde normal si no
        borderColor: sel && sel.id === item.id ? theme.colors.primary : theme.colors.border, 
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        marginHorizontal: 4,
        backgroundColor: theme.colors.card, // 👈 Fondo de la card
        // Se mantiene la sombra con valores fijos
        shadowColor: "#000",
        shadowOffset: {
          width: 0,
          height: 1,
        },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      }}
      activeOpacity={0.7}
    >
      {/* Contenedor principal */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          flex: 1,
          minHeight: 50,
        }}
      >
        {/* Círculo de selección */}
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            // Fondo primario si está seleccionado, inputBorder si no
            backgroundColor: sel && sel.id === item.id ? theme.colors.primary : theme.colors.inputBorder,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Text
            style={{
              // Texto blanco si está seleccionado, textMuted si no
              color: sel && sel.id === item.id ? "#fff" : theme.colors.textMuted,
              fontSize: 14,
              marginTop: -1,
            }}
          >
            ✓
          </Text>
        </View>

        {/* Información del depósito */}
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text
            style={{
              fontSize: 17,
              fontWeight: "600",
              color: theme.colors.text, // 👈 Color del nombre
              marginBottom: 4,
            }}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: theme.colors.textMuted, // 👈 Color de la dirección
              lineHeight: 18,
            }}
            numberOfLines={2}
          >
            {item.address || "Av. Corrientes 1234, CABA"}
          </Text>
        </View>

        {/* Badge de estado */}
        <View
          style={{
            // Fondo Success o Danger
            backgroundColor: branchStatus[item.id] ? theme.colors.success : theme.colors.danger,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 10,
            alignSelf: "flex-start",
            marginTop: 2,
            opacity: 0.8, // Opacidad para que el color sea más suave en el badge
          }}
        >
          <Text
            style={{
              color: 'white', // Texto blanco fijo para contraste
              fontSize: 12,
              fontWeight: "500",
            }}
          >
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
      if (sel) {
        await setBranch(sel.id, sel.name);
        await pullBranchCatalog(sel.id); // primer pull (full)
      }
    } catch (e) {
      console.log("SYNC_BRANCH_CATALOG_FAIL", e);
    } finally {
      setSyncing(false);
      navigation.replace("Home");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}> {/* 👈 Fondo de la pantalla */}
      {/* Contenedor principal con padding seguro */}
      <View style={{ flex: 1, padding: 16, paddingTop: 32 }}>
        {loading && (
          <ActivityIndicator
            size="large"
            color={theme.colors.primary} // 👈 Color primario
            style={{ marginTop: 20 }}
          />
        )}
        {err ? (
          <Text style={{ color: theme.colors.danger, marginBottom: 8, textAlign: "center" }}> {/* 👈 Color danger */}
            {err}
          </Text>
        ) : null}

        {!loading && !err && branches.length === 0 ? (
          <Text style={{ textAlign: "center", color: theme.colors.text }}>No hay sucursales.</Text>
        ) : (
          <FlatList
            data={branches}
            keyExtractor={(i, idx) => (i?.id ? i.id : String(idx))}
            renderItem={renderItem}
            contentContainerStyle={{
              paddingHorizontal: 8,
              paddingTop: "6%", 
              paddingBottom: 100, 
            }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Contenedor del botón flotante */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: theme.colors.inputBackground, // 👈 Fondo del contenedor del botón
          paddingHorizontal: 16,
          paddingBottom: 16,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border, // 👈 Borde superior
        }}
      >
        <TouchableOpacity
          style={{
            // Fondo primario si está seleccionado, neutral si no
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
              style={{
                color: "white",
                fontWeight: "600",
                fontSize: 16,
                opacity: sel ? 1 : 0.7,
              }}
            >
              {sel ? `Continuar con ${sel.name}` : "Seleccioná una sucursal"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}