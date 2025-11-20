// src/components/ProductEditModal.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  ActivityIndicator,
  StyleSheet, // Agregué StyleSheet para ordenar un poco
} from "react-native";

type Props = {
  visible: boolean;
  code: string | null;
  initialName?: string;
  initialPrice?: number;
  initialStock?: number;
  onCancel: () => void;
  onSave: (data: {
    code: string;
    name: string;
    price: number;
    stock?: number;
  }) => void | Promise<void>;
};

// Objeto simple para manejar errores
type ValidationErrors = {
  code?: string;
  name?: string;
  price?: string;
  stock?: string;
};

export default function ProductEditModal({
  visible,
  code,
  initialName = "",
  initialPrice = 0,
  initialStock = 0,
  onCancel,
  onSave,
}: Props) {
  // Estados de datos
  const [codeStr, setCodeStr] = useState(code || "");
  const [name, setName] = useState(initialName);
  const [priceStr, setPriceStr] = useState(String(initialPrice ?? 0));
  const [stockStr, setStockStr] = useState(String(initialStock ?? 0));
  const [saving, setSaving] = useState(false);

  // Estado de errores (La clave para que el usuario entienda qué pasa)
  const [errors, setErrors] = useState<ValidationErrors>({});

  const codeRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);
  const priceRef = useRef<TextInput>(null);
  const stockRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setCodeStr(code || "");
      setName(initialName || "");
      setPriceStr(String(initialPrice ?? 0));
      setStockStr(String(initialStock ?? 0));
      setErrors({}); // Limpio errores al abrir
      setTimeout(() => codeRef.current?.focus(), 200);
    }
  }, [visible, code, initialName, initialPrice, initialStock]);

  const parsePrice = () => {
    // Reemplazo coma por punto para asegurar compatibilidad
    const v = parseFloat(priceStr.replace(",", "."));
    return isNaN(v) ? 0 : v;
  };

  const parseStock = () => {
    const n = parseInt(
      (stockStr ?? "0").replace(",", ".").split(".")[0] || "0",
      10
    );
    return isNaN(n) ? 0 : n;
  };

  const validate = (): boolean => {
    const newErrors: ValidationErrors = {};
    let isValid = true;

    // 1. Validar Código
    if (!codeStr.trim()) {
      newErrors.code = "El código es obligatorio.";
      isValid = false;
    }

    // 2. Validar Nombre
    if (!name.trim()) {
      newErrors.name = "El nombre es obligatorio.";
      isValid = false;
    }

    // 3. Validar Precio
    const priceVal = parsePrice();
    if (priceVal <= 0) {
      newErrors.price = "El precio debe ser mayor a 0.";
      isValid = false;
    }

    // 4. Validar Stock (Opcional, pero buena práctica no permitir negativos)
    const stockVal = parseStock();
    if (stockVal < 0) {
      newErrors.stock = "El stock no puede ser negativo.";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSave = async () => {
    if (saving) return;

    // Primero validamos. Si falla, cortamos acá y mostramos los errores visuales.
    if (!validate()) {
      return;
    }

    setSaving(true);
    try {
      await onSave({
        code: codeStr.trim(),
        name: name.trim(),
        price: parsePrice(),
        stock: parseStock(),
      });
    } catch (e) {
      console.error("Error guardando producto", e);
      // Acá podrías setear un error general si quisieras
    } finally {
      setSaving(false);
    }
  };

  const isEdit = !!initialName || !!initialPrice || !!initialStock;

  // Helper para input style dinámico
  const getInputStyle = (hasError: boolean) => ({
    borderWidth: 1,
    borderColor: hasError ? "#ef4444" : "#cbd5e1", // Rojo si hay error
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#ffffff",
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
          >
            <View
              style={{
                backgroundColor: "white",
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                height: 450, // Aumenté un poquito la altura por los msj de error
              }}
            >
              <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                <View style={{ alignItems: "center", marginBottom: 8 }}>
                  <View
                    style={{
                      width: 40,
                      height: 4,
                      backgroundColor: "#e2e8f0",
                      borderRadius: 2,
                    }}
                  />
                </View>

                <Text
                  style={{ fontSize: 16, fontWeight: "700", marginBottom: 12 }}
                >
                  {isEdit ? "Editar producto" : "Nuevo producto"}
                </Text>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  paddingBottom: 16,
                }}
                showsVerticalScrollIndicator={false}
              >
                <View style={{ gap: 12 }}>
                  {/* INPUT CODIGO */}
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontWeight: "600" }}>
                      Código <Text style={{ color: "#ef4444" }}>*</Text>
                    </Text>
                    <TextInput
                      ref={codeRef}
                      value={codeStr}
                      onChangeText={(t) => {
                        setCodeStr(t);
                        if (errors.code)
                          setErrors({ ...errors, code: undefined });
                      }}
                      placeholder="Código del producto"
                      style={getInputStyle(!!errors.code)}
                      returnKeyType="next"
                      onSubmitEditing={() => nameRef.current?.focus()}
                    />
                    {errors.code && (
                      <Text style={{ color: "#ef4444", fontSize: 12 }}>
                        {errors.code}
                      </Text>
                    )}
                  </View>

                  {/* INPUT NOMBRE */}
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontWeight: "600" }}>
                      Nombre <Text style={{ color: "#ef4444" }}>*</Text>
                    </Text>
                    <TextInput
                      ref={nameRef}
                      value={name}
                      onChangeText={(t) => {
                        setName(t);
                        if (errors.name)
                          setErrors({ ...errors, name: undefined });
                      }}
                      placeholder="Nombre del producto"
                      style={getInputStyle(!!errors.name)}
                      returnKeyType="next"
                      onSubmitEditing={() => priceRef.current?.focus()}
                    />
                    {errors.name && (
                      <Text style={{ color: "#ef4444", fontSize: 12 }}>
                        {errors.name}
                      </Text>
                    )}
                  </View>

                  {/* INPUT PRECIO */}
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontWeight: "600" }}>
                      Precio <Text style={{ color: "#ef4444" }}>*</Text>
                    </Text>
                    <View
                      style={[
                        {
                          flexDirection: "row",
                          alignItems: "center",
                          borderRadius: 8,
                          backgroundColor: "#ffffff",
                          borderWidth: 1,
                        },
                        { borderColor: errors.price ? "#ef4444" : "#cbd5e1" },
                      ]}
                    >
                      <Text
                        style={{
                          paddingLeft: 10,
                          color: "#64748b",
                          fontSize: 16,
                        }}
                      >
                        $
                      </Text>
                      <TextInput
                        ref={priceRef}
                        value={priceStr}
                        onChangeText={(t) => {
                          setPriceStr(t);
                          if (errors.price)
                            setErrors({ ...errors, price: undefined });
                        }}
                        placeholder="0"
                        keyboardType="decimal-pad"
                        style={{ flex: 1, padding: 10, paddingLeft: 4 }}
                        returnKeyType="next"
                        onSubmitEditing={() => stockRef.current?.focus()}
                      />
                    </View>
                    {errors.price && (
                      <Text style={{ color: "#ef4444", fontSize: 12 }}>
                        {errors.price}
                      </Text>
                    )}
                  </View>

                  {/* INPUT STOCK */}
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontWeight: "600" }}>
                      {isEdit ? "Stock" : "Stock inicial"}{" "}
                      <Text style={{ color: "#64748b" }}>(entero)</Text>
                    </Text>
                    <TextInput
                      ref={stockRef}
                      value={stockStr}
                      onChangeText={(t) => {
                        setStockStr(t);
                        if (errors.stock)
                          setErrors({ ...errors, stock: undefined });
                      }}
                      placeholder="0"
                      keyboardType="number-pad"
                      style={getInputStyle(!!errors.stock)}
                      returnKeyType="done"
                      onSubmitEditing={handleSave}
                    />
                    {errors.stock && (
                      <Text style={{ color: "#ef4444", fontSize: 12 }}>
                        {errors.stock}
                      </Text>
                    )}
                  </View>
                </View>
              </ScrollView>

              {/* BOTONES */}
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingBottom: 16,
                  paddingTop: 8,
                  backgroundColor: "white",
                }}
              >
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <TouchableOpacity
                    onPress={onCancel}
                    style={{
                      flex: 1,
                      backgroundColor: "#f1f5f9",
                      paddingVertical: 12,
                      borderRadius: 10,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "#334155", fontWeight: "600" }}>
                      Cancelar
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving}
                    style={{
                      flex: 1,
                      backgroundColor: saving ? "#94a3b8" : "#007AFF",
                      paddingVertical: 12,
                      borderRadius: 10,
                      alignItems: "center",
                      flexDirection: "row",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    {saving && <ActivityIndicator color="white" size="small" />}
                    <Text style={{ color: "white", fontWeight: "700" }}>
                      {saving ? "Guardando..." : "Guardar"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
