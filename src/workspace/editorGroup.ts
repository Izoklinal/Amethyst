export type EditorTab = {
  id: string;
  title: string;
  path: string;
};

export type EditorGroup = {
  id: string;
  tabs: EditorTab[];
  activeTabId: string | null;
};

export function createInitialGroup(): EditorGroup {
  return {
    id: "group-1",
    tabs: [],
    activeTabId: null,
  };
}

export function openNoteTab(
  group: EditorGroup,
  path: string,
  title: string,
  id: string,
): EditorGroup {
  const existing = group.tabs.find((tab) => tab.path === path);
  if (existing) {
    return { ...group, activeTabId: existing.id };
  }
  return {
    ...group,
    tabs: [...group.tabs, { id, title, path }],
    activeTabId: id,
  };
}

export function activateTab(group: EditorGroup, tabId: string): EditorGroup {
  if (!group.tabs.some((tab) => tab.id === tabId)) {
    return group;
  }
  return { ...group, activeTabId: tabId };
}

export function closeTab(group: EditorGroup, tabId: string): EditorGroup {
  const tabs = group.tabs.filter((tab) => tab.id !== tabId);
  if (tabs.length === group.tabs.length) {
    return group;
  }
  const activeTabId =
    group.activeTabId === tabId ? (tabs[0]?.id ?? null) : group.activeTabId;
  return { ...group, tabs, activeTabId };
}

export function cycleTab(group: EditorGroup, direction: 1 | -1): EditorGroup {
  if (group.tabs.length < 2 || !group.activeTabId) {
    return group;
  }
  const index = group.tabs.findIndex((tab) => tab.id === group.activeTabId);
  if (index < 0) {
    return group;
  }
  const next =
    (index + direction + group.tabs.length) % group.tabs.length;
  return { ...group, activeTabId: group.tabs[next].id };
}
