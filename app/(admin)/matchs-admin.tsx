import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    Image as RNImage,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useAdmin } from "../../contexts/AdminContext";
import { supabase } from "../../supabase";

// LOGOS ASSOCIES
const LOGOS: Record<string, any> = {
  "Rouen": require("../../assets/images/Rouen.jpg"),
  "Le Havre": require("../../assets/images/Le_Havre.png"),
  "Cherbourg": require("../../assets/images/Cherbourg.jpg"),
  "Caen": require("../../assets/images/Caen.png"),
  "Les Andelys": require("../../assets/images/les_Andelys.png"), // minuscule dans le nom du fichier !
  "Louviers": require("../../assets/images/Louviers.png"),
};

const ADVERSAIRES = [
  "Rouen",
  "Le Havre",
  "Cherbourg",
  "Caen",
  "Les Andelys",
  "Louviers"
];

const logoComets = require("../../assets/images/iconComets.png");

const initialForm = {
  date: "",
  opponent: "",
  is_home: true,
  note: "",
};

export default function AdminMatchsScreen({ navigation }: any) {
  const { isAdmin } = useAdmin();
  const router = useRouter();
  const [matchs, setMatchs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...initialForm });

  // Dropdown States
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const dropdownBtnRef = useRef<any>(null);

  const [showDatePicker, setShowDatePicker] = useState(false);

  async function fetchMatchs() {
    setLoading(true);
    const { data, error } = await supabase
      .from("matches_planned")
      .select("*")
      .order("date", { ascending: true });
    if (!error && data) setMatchs(data);
    setLoading(false);
  }

  useEffect(() => {
    if (isAdmin) fetchMatchs();
  }, [isAdmin]);

  function handleChange(k: string, v: any) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function openDatePicker() {
    setShowDatePicker(true);
  }
  function onDateChange(event: any, selectedDate?: Date) {
    setShowDatePicker(false);
    if (selectedDate) {
      const iso = selectedDate.toISOString().slice(0, 10);
      handleChange("date", iso);
    }
  }

  async function handleSave() {
    if (!form.date || !form.opponent) {
      Alert.alert("Champ requis", "Date et adversaire sont obligatoires.");
      return;
    }
    setLoading(true);
    try {
      const row = {
        ...form,
        logo: null, // auto
      };
      if (editId) {
        await supabase
          .from("matches_planned")
          .update(row)
          .eq("id", editId);
      } else {
        await supabase
          .from("matches_planned")
          .insert([row]);
      }
      setForm({ ...initialForm });
      setEditId(null);
      fetchMatchs();
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    Alert.alert(
      "Supprimer ce match ?",
      "Confirmer la suppression du match.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            await supabase.from("matches_planned").delete().eq("id", id);
            fetchMatchs();
            setLoading(false);
          },
        },
      ]
    );
  }

  function handleEdit(match: any) {
    setForm({
      date: match.date ? match.date.slice(0, 10) : "",
      opponent: match.opponent,
      is_home: match.is_home,
      note: match.note || "",
    });
    setEditId(match.id);
  }

  function getLogo(opponent: string) {
    return LOGOS[opponent] || null;
  }

  // Fermeture dropdown si on clique ailleurs
  useEffect(() => {
    if (!dropdownVisible) return;
    const close = () => setDropdownVisible(false);
    const sub = navigation?.addListener?.("blur", close);
    return () => sub && sub();
  }, [dropdownVisible]);

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.forbidden}>Accès réservé aux admins !</Text>
      </View>
    );
  }

  // Calcul dimensions écran pour dropdown si besoin (éviter overflow)
  const screenHeight = Dimensions.get("window").height;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#18181C" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Dropdown flottant, s'affiche par-dessus tout */}
      {dropdownVisible && (
        <>
          <Pressable
            style={{
              position: "absolute",
              left: 0, top: 0, right: 0, bottom: 0,
              zIndex: 8888,
            }}
            onPress={() => setDropdownVisible(false)}
          />
          <View
            style={[
              styles.absoluteDropdownList,
              {
                top: dropdownPos.top,
                left: dropdownPos.left,
                width: dropdownPos.width,
                maxHeight: Math.min(240, screenHeight - dropdownPos.top - 60),
              },
            ]}
          >
            <FlatList
              data={ADVERSAIRES}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    handleChange("opponent", item);
                    setDropdownVisible(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{item}</Text>
                </TouchableOpacity>
              )}
              nestedScrollEnabled
            />
          </View>
        </>
      )}

      {/* Logo Comets */}
      <View style={styles.logoBox}>
        <RNImage source={logoComets} style={styles.logo} resizeMode="contain" />
      </View>
      {/* Padding supplémentaire */}
      <View style={{ height: 16 }} />
      {/* Header sombre */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack && router.canGoBack()) {
              router.back();
            } else if (navigation && navigation.goBack) {
              navigation.goBack();
            }
          }}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="chevron-back" size={28} color="#FF8200" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ajout de match – admin</Text>
        <View style={{ width: 38 }} />
      </View>
      {/* Padding supplémentaire entre header et form */}
      <View style={{ height: 12 }} />
      {/* FORMULAIRE */}
      <View style={styles.form}>
        <TouchableOpacity style={styles.inputRow} onPress={openDatePicker}>
          <Text style={styles.label}>Date</Text>
          <Text style={styles.inputText}>
            {form.date ? form.date : "Choisir une date"}
          </Text>
          <Icon name="calendar-outline" size={20} color="#FF8200" />
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={form.date ? new Date(form.date) : new Date()}
            mode="date"
            display="default"
            onChange={onDateChange}
            minimumDate={new Date("2023-01-01")}
            maximumDate={new Date("2030-12-31")}
          />
        )}
        <View style={styles.inputRow}>
          <Text style={styles.label}>Adversaire</Text>
          <View style={styles.dropdown}>
            <TouchableOpacity
              ref={dropdownBtnRef}
              style={styles.dropdownBtn}
              onPress={() => {
                dropdownBtnRef.current.measure((fx, fy, width, height, px, py) => {
                  setDropdownPos({ top: py + height, left: px, width });
                  setDropdownVisible(true);
                });
              }}
            >
              <Text style={styles.inputText}>
                {form.opponent || "Choisir"}
              </Text>
              <Icon name="chevron-down-outline" size={18} color="#b36a00" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.inputRow}>
          <Text style={styles.label}>Lieu</Text>
          <TouchableOpacity
            style={[
              styles.placeBtn,
              form.is_home ? styles.placeSelected : {},
            ]}
            onPress={() => handleChange("is_home", true)}
          >
            <Text
              style={[
                styles.placeText,
                form.is_home ? styles.placeTextSelected : {},
              ]}
            >
              Domicile
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.placeBtn,
              !form.is_home ? styles.placeSelected : {},
            ]}
            onPress={() => handleChange("is_home", false)}
          >
            <Text
              style={[
                styles.placeText,
                !form.is_home ? styles.placeTextSelected : {},
              ]}
            >
              Extérieur
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.inputRow}>
          <Text style={styles.label}>Note</Text>
          <TextInput
            style={styles.input}
            value={form.note}
            onChangeText={t => handleChange("note", t)}
            placeholder="Note (optionnel)"
            placeholderTextColor="#b36a00"
            maxLength={64}
          />
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.saveText}>
              {editId ? "Modifier" : "Ajouter"}
            </Text>
          </TouchableOpacity>
          {editId && (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setEditId(null);
                setForm({ ...initialForm });
              }}
            >
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {/* LISTE DES MATCHS */}
      <FlatList
        data={matchs}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              {/* Logo équipe */}
              {getLogo(item.opponent) && (
                <RNImage
                  source={getLogo(item.opponent)}
                  style={styles.matchLogo}
                  resizeMode="contain"
                />
              )}
              <Text style={styles.cardDate}>
                {item.date ? item.date.slice(0, 10) : ""}
              </Text>
              <Text style={styles.cardOpponent}>{item.opponent}</Text>
              <TouchableOpacity onPress={() => handleEdit(item)}>
                <Icon name="create-outline" size={20} color="#FF8200" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Icon name="trash-outline" size={20} color="#C50F0F" />
              </TouchableOpacity>
            </View>
            <Text style={item.is_home ? styles.cardLieuHome : styles.cardLieuAway}>
              {item.is_home ? "Domicile" : "Extérieur"}
            </Text>
            {item.note ? (
              <Text style={styles.cardNote}>{item.note}</Text>
            ) : null}
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 90 }}
        style={{ marginTop: 10 }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#FF8200" />
          ) : (
            <Text style={{ color: "#aaa", textAlign: "center", marginTop: 44 }}>
              Aucun match à venir pour l’instant…
            </Text>
          )
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  logoBox: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    marginTop: 34,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#FF8200",
    backgroundColor: "#fff",
    shadowColor: "#FF8200",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 2,
    paddingTop: Platform.OS === "ios" ? 12 : 7,
    paddingBottom: 10,
    backgroundColor: "#18181C",
    borderBottomColor: "#FF8200",
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 4,
    marginRight: 10,
    marginLeft: 2,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "bold",
    color: "#FF8200",
    textAlign: "center",
    letterSpacing: 0.8,
  },
  form: {
    backgroundColor: "#FFF3E0",
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    shadowColor: "#FF8200",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 1,
    marginHorizontal: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  label: {
    fontWeight: "bold",
    color: "#B36A00",
    minWidth: 78,
  },
  input: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    fontSize: 15.5,
    color: "#B36A00",
    borderWidth: 1,
    borderColor: "#FF8200",
  },
  inputText: {
    color: "#B36A00",
    fontSize: 15.5,
    marginRight: 7,
  },
  dropdown: {
    flex: 1,
    position: "relative",
  },
  dropdownBtn: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FF8200",
    paddingVertical: 7,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minWidth: 90,
  },
  absoluteDropdownList: {
    position: "absolute",
    zIndex: 9999,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FF8200",
    // maxHeight: dynamique
    overflow: "hidden",
    elevation: 10,
  },
  dropdownItem: {
    padding: 11,
    borderBottomColor: "#ffe0b2",
    borderBottomWidth: 1,
  },
  dropdownItemText: {
    color: "#B36A00",
    fontSize: 15.5,
  },
  placeBtn: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.1,
    borderColor: "#FF8200",
    backgroundColor: "#fff",
    marginRight: 7,
  },
  placeSelected: {
    backgroundColor: "#FF8200",
  },
  placeText: {
    color: "#FF8200",
    fontWeight: "bold",
  },
  placeTextSelected: {
    color: "#fff",
  },
  saveBtn: {
    backgroundColor: "#FF8200",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 22,
    elevation: 2,
  },
  saveText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  cancelBtn: {
    backgroundColor: "#eee",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelText: {
    color: "#C50F0F",
    fontWeight: "bold",
    fontSize: 16,
  },
  card: {
    backgroundColor: "#fff8ef",
    borderRadius: 18,
    padding: 13,
    marginBottom: 10,
    shadowColor: "#FF8200",
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1.2,
    borderColor: "#FF8200",
    marginHorizontal: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 7,
  },
  matchLogo: {
    width: 40,
    height: 40,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#ffe0b2",
    backgroundColor: "#fff",
    marginRight: 8,
  },
  cardDate: {
    color: "#FF8200",
    fontWeight: "bold",
    fontSize: 15,
    minWidth: 82,
  },
  cardOpponent: {
    color: "#b36a00",
    fontSize: 16.5,
    fontWeight: "bold",
    flex: 1,
  },
  cardLieuHome: {
    backgroundColor: "#C6F6D5",
    color: "#187941",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 7,
    alignSelf: "flex-start",
    fontWeight: "bold",
    marginTop: 2,
    marginBottom: 2,
  },
  cardLieuAway: {
    backgroundColor: "#FECACA",
    color: "#AB2222",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 7,
    alignSelf: "flex-start",
    fontWeight: "bold",
    marginTop: 2,
    marginBottom: 2,
  },
  cardNote: {
    color: "#888",
    fontSize: 13,
    marginTop: 5,
  },
  centered: {
    flex: 1,
    backgroundColor: "#18181C",
    justifyContent: "center",
    alignItems: "center",
  },
  forbidden: {
    color: "#FF8200",
    fontSize: 18,
    fontWeight: "bold",
  },
});
