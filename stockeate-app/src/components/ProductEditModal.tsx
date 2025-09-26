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
} from "react-native";

type Props = {
  visible: boolean;
  code: string | null;
  initialName?: string;
  initialPrice?: number;
  /** NUEVO: stock inicial opcional para prefijar el campo cuando edites */
  initialStock?: number;
  onCancel: () => void;
  onSave: (data: { name: string; price: number; stock?: number }) => void;
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
  const [name, setName] = useState(initialName);
  const [priceStr, setPriceStr] = useState(String(initialPrice ?? 0));
  const [stockStr, setStockStr] = useState(String(initialStock ?? 0));

  const nameRef = useRef<TextInput>(null);
  const priceRef = useRef<TextInput>(null);
  const stockRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setName(initialName || (code ?? ""));
      setPriceStr(String(initialPrice ?? 0));
      setStockStr(String(initialStock ?? 0));
      setTimeout(() => {
        nameRef.current?.focus();
      }, 200);
    }
  }, [visible, code, initialName, initialPrice, initialStock]);

  const parsePrice = () => {
    const v = parseFloat(priceStr.replace(",", "."));
    return isNaN(v) ? 0 : v;
  };

  const parseStock = () => {
    const n = parseInt(stockStr.replace(",", ".").split(".")[0] || "0", 10);
    return isNaN(n) ? 0 : n;
  };

  const handleSave = () => {
    const price = parsePrice();
    const stock = parseStock();
    const nm = name.trim();
    if (!nm) return;
    onSave({ name: nm, price, stock });
  };

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
                padding: 16,
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                maxHeight: "80%",
              }}
            >
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

              <Text style={{ fontSize: 16, fontWeight: "700", marginBottom: 12 }}>
                Nuevo producto ({code ?? ""})
              </Text>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ gap: 12, paddingBottom: 12 }}
              >
                <View style={{ gap: 6 }}>
                  <Text style={{ fontWeight: "600" }}>Nombre</Text>
                  <TextInput
                    ref={nameRef}
                    value={name}
                    onChangeText={setName}
                    placeholder="Nombre del producto"
                    style={{
                      borderWidth: 1,
                      borderColor: "#cbd5e1",
                      borderRadius: 8,
                      padding: 10,
                      backgroundColor: "#ffffff",
                    }}
                    returnKeyType="next"
                    onSubmitEditing={() => priceRef.current?.focus()}
                  />
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={{ fontWeight: "600" }}>Precio</Text>
                  <TextInput
                    ref={priceRef}
                    value={priceStr}
                    onChangeText={setPriceStr}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    style={{
                      borderWidth: 1,
                      borderColor: "#cbd5e1",
                      borderRadius: 8,
                      padding: 10,
                      backgroundColor: "#ffffff",
                    }}
                    returnKeyType="next"
                    onSubmitEditing={() => stockRef.current?.focus()}
                  />
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={{ fontWeight: "600" }}>
                    Stock inicial <Text style={{ color: "#64748b" }}>(opcional)</Text>
                  </Text>
                  <TextInput
                    ref={stockRef}
                    value={stockStr}
                    onChangeText={setStockStr}
                    placeholder="0"
                    keyboardType="number-pad"
                    style={{
                      borderWidth: 1,
                      borderColor: "#cbd5e1",
                      borderRadius: 8,
                      padding: 10,
                      backgroundColor: "#ffffff",
                    }}
                    returnKeyType="done"
                    onSubmitEditing={handleSave}
                  />
                </View>
              </ScrollView>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginTop: 8,
                  gap: 12,
                }}
              >
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
                  style={{
                    flex: 1,
                    backgroundColor: "#007AFF",
                    paddingVertical: 12,
                    borderRadius: 10,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "700" }}>
                    Guardar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
