import { Platform } from "react-native";

// Carga dinámica para evitar errores de unión de tipos e imports innecesarios
let impl: any;
if (Platform.OS === "web") {
  impl = require("./db.web");
} else {
  impl = require("./db.native");
}

export const initDb = impl.initDb;
export const DB = impl.DB;