import { SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import type { CategoryNode } from "./types";
import styles from "./JobGraph.module.css";

interface GraphControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  categories: CategoryNode[];
  selectedCategories: string[];
  onCategoryToggle: (category: string) => void;
  onRebuild: () => void;
  loading: boolean;
}

export function GraphControls({
  searchQuery,
  onSearchChange,
  categories,
  selectedCategories,
  onCategoryToggle,
  onRebuild,
  loading,
}: GraphControlsProps) {
  return (
    <div className={styles.controlsBar}>
      <div className={styles.searchWrapper}>
        <SearchOutlined className={styles.searchIcon} />
        <input
          type="text"
          placeholder="搜索岗位..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          className={styles.searchInput}
        />
      </div>

      <div className={styles.categoryChips}>
        {categories.map((category) => {
          const isSelected =
            selectedCategories.length === 0 ||
            selectedCategories.includes(category.label);

          return (
            <button
              key={category.id}
              className={`${styles.chip} ${isSelected ? styles.chipActive : ""}`}
              onClick={() => onCategoryToggle(category.label)}
              style={
                isSelected
                  ? {
                      backgroundColor: `${category.color}18`,
                      borderColor: `${category.color}99`,
                      color: category.color,
                    }
                  : undefined
              }
            >
              {category.icon} {category.label}
            </button>
          );
        })}
      </div>

      <button
        className={`${styles.rebuildBtn} ${loading ? styles.rebuildLoading : ""}`}
        onClick={onRebuild}
        disabled={loading}
        title="刷新图谱"
      >
        <ReloadOutlined spin={loading} />
      </button>
    </div>
  );
}
