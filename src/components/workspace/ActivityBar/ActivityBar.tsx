import { IconButton } from "../../ui/IconButton/IconButton";
import { FolderIcon, SearchIcon, ThemeIcon } from "../../ui/icons";
import type { Theme } from "../../../theme/theme";
import type { ToolId } from "../../../workspace/layoutState";
import styles from "./ActivityBar.module.css";

type ActivityBarProps = {
  activeTool: ToolId;
  theme: Theme;
  onSelectTool: (tool: ToolId) => void;
  onToggleTheme: () => void;
};

export function ActivityBar({
  activeTool,
  theme,
  onSelectTool,
  onToggleTheme,
}: ActivityBarProps) {
  return (
    <nav className={styles.bar} aria-label="Activity">
      <div className={styles.tools}>
        <IconButton
          label="Explorer"
          current={activeTool === "explorer"}
          onClick={() => onSelectTool("explorer")}
        >
          <FolderIcon />
        </IconButton>
        <IconButton
          label="Search"
          current={activeTool === "search"}
          onClick={() => onSelectTool("search")}
        >
          <SearchIcon />
        </IconButton>
      </div>
      <IconButton
        label={theme === "light" ? "Use dark theme" : "Use light theme"}
        pressed={theme === "dark"}
        onClick={onToggleTheme}
      >
        <ThemeIcon />
      </IconButton>
    </nav>
  );
}
