import { useState } from "react";
import { SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import { JOB_CATEGORIES } from "../../constants";
import styles from "./JobGraph.module.css";

interface GraphControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategories: string[];
  onCategoryToggle: (category: string) => void;
  onRebuild: () => void;
  loading: boolean;
}

export function GraphControls({
  searchQuery,
  onSearchChange,
  selectedCategories,
  onCategoryToggle,
  onRebuild,
  loading,
}: GraphControlsProps) {
  return (
    <div className={styles.controlsBar}>
      {/* Search input */}
      <div className={styles.searchWrapper}>
        <SearchOutlined className={styles.searchIcon} />
        <input
          type="text"
          placeholder="搜索岗位..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      {/* Category chips */}
      <div className={styles.categoryChips}>
        {Object.entries(JOB_CATEGORIES).map(([category, meta]) => {
          const isSelected =
            selectedCategories.length === 0 ||
            selectedCategories.includes(category);
          return (
            <button
              key={category}
              className={`${styles.chip} ${isSelected ? styles.chipActive : ""}`}
              onClick={() => onCategoryToggle(category)}
              style={
                isSelected
                  ? {
                      backgroundColor: `${meta.color}26`,
                      borderColor: meta.color,
                      color: meta.color,
                    }
                  : {}
              }
            >
              {meta.icon} {category}
            </button>
          );
        })}
      </div>

      {/* Rebuild button */}
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
