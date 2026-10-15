import { Modal, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconButton, Note } from "../ui";
import { AddRecordForm } from ".";
import { colors } from "../../theme";

// A full-screen AddRecordForm — the mobile stand-in for the web's
// <Modal><AddRecordForm/></Modal> pattern.
export default function FormSheet({ visible, title, note, fields, initialValues, onSubmit, onClose, submitLabel }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", flex: 1 }} numberOfLines={1}>
            {title}
          </Text>
          <IconButton name="close" color={colors.text} onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {note ? <Note>{note}</Note> : null}
          {visible ? <AddRecordForm fields={fields} initialValues={initialValues} onSubmit={onSubmit} onCancel={onClose} submitLabel={submitLabel} /> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
