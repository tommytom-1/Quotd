import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { BookOpen, Home, Plus, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { LoadingScreen } from "@/components/loading-screen";
import { ProfileAvatar } from "@/components/profile-avatar";
import { QuoteCard } from "@/components/quote-card";
import { QuoteDetailSheet } from "@/components/quote-detail-sheet";
import { useApp } from "@/context/app-context";
import {
  filterBySpeaker,
  getUniqueSpeakers,
  groupByMonth,
  sortNewest,
} from "@/lib/quote-utils";
import type { QuoteRecord } from "@/lib/types";

export default function QuotesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isLoading, palette, profile, quotes, resolvedTheme } = useApp();
  const [selectedSpeaker, setSelectedSpeaker] = useState("All");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<QuoteRecord | null>(null);

  const speakers = useMemo(() => getUniqueSpeakers(quotes), [quotes]);
  const displayedQuotes = useMemo(
    () => sortNewest(filterBySpeaker(quotes, selectedSpeaker)),
    [quotes, selectedSpeaker]
  );
  const sections = useMemo(
    () => groupByMonth(displayedQuotes),
    [displayedQuotes]
  );

  useEffect(() => {
    if (selectedSpeaker !== "All" && !speakers.includes(selectedSpeaker)) {
      setSelectedSpeaker("All");
    }
  }, [selectedSpeaker, speakers]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  const openCapture = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.warn("[quotd-haptics]", error);
    }
    router.push("/capture");
  };

  const chooseSpeaker = async (speaker: string) => {
    try {
      await Haptics.selectionAsync();
    } catch (error) {
      console.warn("[quotd-haptics]", error);
    }
    setSelectedSpeaker(speaker);
    setFiltersExpanded(false);
  };

  const expandedFilterChips = filtersExpanded
    ? ["All", ...speakers].map((speaker) => (
        <FilterChip
          key={speaker}
          label={speaker}
          onPress={() => chooseSpeaker(speaker)}
          selected={selectedSpeaker === speaker}
        />
      ))
    : null;
  const selectedFilterChip =
    filtersExpanded || selectedSpeaker === "All" ? null : (
      <Pressable
        accessibilityLabel={`Remove ${selectedSpeaker} filter`}
        accessibilityRole="button"
        onPress={() => chooseSpeaker("All")}
        style={[
          styles.selectedFilter,
          { backgroundColor: palette.inverseSurface },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[styles.selectedFilterText, { color: palette.inverseText }]}
        >
          {selectedSpeaker}
        </Text>
        <View style={styles.filterX}>
          <X color={palette.inverseText} size={9} strokeWidth={2.5} />
        </View>
      </Pressable>
    );

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safeArea, { backgroundColor: palette.background }]}
    >
      <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />

      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: palette.text }]}>My Quotes</Text>
          <Text style={[styles.count, { color: palette.textMuted }]}>
            {quotes.length} {quotes.length === 1 ? "Quote" : "Quotes"}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel="Home"
            onPress={() => router.dismissTo("/")}
            style={({ pressed }) => [
              styles.headerIcon,
              { backgroundColor: palette.surface },
              pressed && styles.pressed,
            ]}
          >
            <Home color={palette.textSecondary} size={16} strokeWidth={1.8} />
          </Pressable>
          <Pressable
            accessibilityLabel="Profile settings"
            onPress={() => router.push("/profile")}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ProfileAvatar size={38} uri={profile.avatarUri} />
          </Pressable>
        </View>
      </View>

      {quotes.length > 0 ? (
        <ScrollView
          contentContainerStyle={styles.filterContent}
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          style={styles.filters}
        >
          <FilterChip
            label="Filter"
            onPress={() => setFiltersExpanded((current) => !current)}
            selected={filtersExpanded}
          />
          {expandedFilterChips}
          {selectedFilterChip}
        </ScrollView>
      ) : null}

      <SectionList
        contentContainerStyle={[
          styles.listContent,
          sections.length === 0 && styles.emptyListContent,
        ]}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EmptyState
            filtered={quotes.length > 0}
            onAdd={openCapture}
            palette={palette}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <QuoteCard onPress={() => setSelectedQuote(item)} quote={item} />
          </View>
        )}
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionTitle, { color: palette.textMuted }]}>
            {section.title}
          </Text>
        )}
        sections={sections}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
      />

      {quotes.length > 0 ? (
        <LinearGradient
          colors={["transparent", palette.background]}
          locations={[0, 0.72]}
          pointerEvents="none"
          style={[styles.bottomFade, { height: 135 + insets.bottom }]}
        />
      ) : null}

      <View
        pointerEvents="box-none"
        style={[
          styles.fabArea,
          { paddingBottom: Math.max(insets.bottom, 16) + 8 },
        ]}
      >
        <Pressable
          accessibilityLabel="Add a new quote"
          onPress={openCapture}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: palette.inverseSurface,
              shadowColor: "#000000",
            },
            pressed && styles.fabPressed,
          ]}
        >
          <Plus color={palette.inverseText} size={30} strokeWidth={1.65} />
        </Pressable>
      </View>

      {selectedQuote ? (
        <QuoteDetailSheet
          onClose={() => setSelectedQuote(null)}
          onQuoteUpdated={setSelectedQuote}
          quote={selectedQuote}
        />
      ) : null}
    </SafeAreaView>
  );
}

function FilterChip({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  const { palette } = useApp();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        {
          backgroundColor: selected
            ? palette.inverseSurface
            : palette.background,
          borderColor: selected ? palette.inverseSurface : palette.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.filterChipText,
          { color: selected ? palette.inverseText : palette.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function EmptyState({
  filtered,
  onAdd,
  palette,
}: {
  filtered: boolean;
  onAdd: () => void;
  palette: ReturnType<typeof useApp>["palette"];
}) {
  return (
    <View style={styles.emptyState}>
      <View
        style={[styles.emptyIcon, { backgroundColor: palette.surfaceMuted }]}
      >
        <BookOpen color={palette.textMuted} size={24} strokeWidth={1.5} />
      </View>
      <Text style={[styles.emptyTitle, { color: palette.text }]}>
        {filtered ? "No matches" : "No quotes yet"}
      </Text>
      <Text style={[styles.emptyCopy, { color: palette.textMuted }]}>
        {filtered
          ? "Try a different person."
          : "Capture something worth remembering."}
      </Text>
      {filtered ? null : (
        <Pressable
          onPress={onAdd}
          style={({ pressed }) => [
            styles.emptyButton,
            { backgroundColor: palette.inverseSurface },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[styles.emptyButtonText, { color: palette.inverseText }]}
          >
            Add your first quote
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomFade: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
  },
  cardWrap: {
    marginBottom: 11,
    paddingHorizontal: 14,
  },
  count: {
    fontSize: 14,
    marginTop: 2,
  },
  emptyButton: {
    borderRadius: 999,
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  emptyButtonText: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  emptyCopy: {
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 230,
    textAlign: "center",
  },
  emptyIcon: {
    alignItems: "center",
    borderRadius: 32,
    height: 64,
    justifyContent: "center",
    marginBottom: 3,
    width: 64,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  emptyState: {
    alignItems: "center",
    flex: 1,
    gap: 7,
    justifyContent: "center",
    paddingBottom: 90,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  fab: {
    alignItems: "center",
    borderRadius: 42,
    elevation: 8,
    height: 80,
    justifyContent: "center",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    width: 80,
  },
  fabArea: {
    alignItems: "center",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
  },
  fabPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.94 }],
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 190,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  filterContent: {
    gap: 8,
    paddingHorizontal: 20,
  },
  filterX: {
    alignItems: "center",
    backgroundColor: "rgba(128,128,128,0.25)",
    borderRadius: 8,
    height: 16,
    justifyContent: "center",
    width: 16,
  },
  filters: {
    flexGrow: 0,
    marginBottom: 15,
    marginTop: 18,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 11,
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  headerIcon: {
    alignItems: "center",
    borderRadius: 19,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  listContent: {
    paddingBottom: 150,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
  safeArea: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 15,
    marginBottom: 10,
    marginTop: 9,
    paddingHorizontal: 20,
  },
  selectedFilter: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    maxWidth: 220,
    paddingLeft: 15,
    paddingRight: 10,
    paddingVertical: 8,
  },
  selectedFilterText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  title: {
    fontSize: 33,
    fontWeight: "600",
    letterSpacing: -1.05,
    lineHeight: 39,
  },
});
