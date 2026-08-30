import type { ReactElement } from "react";

export interface SpeakerMenuProps {
  children: ReactElement;
  name: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  onRename: () => void;
  onPhoto: () => void;
  onRemovePhoto?: () => void;
}
