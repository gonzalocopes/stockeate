import { Platform } from "react-native";

// Importar la implementación correcta según la plataforma
if (Platform.OS === "web") {
  const { DB, initDb } = require("../db.web");
  module.exports = { DB, initDb };
} else {
  const { DB, initDb } = require("../db.native");
  module.exports = { DB, initDb };
}
