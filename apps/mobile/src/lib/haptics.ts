import * as Haptics from "expo-haptics";

export async function playSuccessHaptic() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (error) {
    console.warn("[quotd-haptics]", error);
  }
}

export async function playSelectionHaptic() {
  try {
    await Haptics.selectionAsync();
  } catch (error) {
    console.warn("[quotd-haptics]", error);
  }
}
