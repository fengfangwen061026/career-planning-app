import { SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import type { GraphCommunity } from "./types";
import styles from "./JobGraph.module.css";

interface GraphControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  communities: GraphCommunity[];
  selectedCommunities: string[];
  onCommunityToggle: (communityId: string) => void;
  onRebuild: () => void;
  loading: boolean;
}

export function GraphControls({
  searchQuery,
  onSearchChange,
  communities,
  selectedCommunities,
  onCommunityToggle,
  onRebuild,
  loading,
}: GraphControlsProps) {
  return (
    <div className={styles.controlsBar}>
      <div className={styles.searchWrapper}>
        <SearchOutlined className={styles.searchIcon} />
        <input
          type="text"
          placeholder="搜索岗位原型..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          className={styles.searchInput}
        />
      </div>

      <div className={styles.communityChips}>
        {communities.map((community) => {
          const isSelected =
            selectedCommunities.length === 0 ||
            selectedCommunities.includes(community.community_id);

          return (
            <button
              key={community.community_id}
              className={`${styles.chip} ${isSelected ? styles.chipActive : ""}`}
              onClick={() => onCommunityToggle(community.community_id)}
              style={
                isSelected
                  ? {
                      backgroundColor: `${community.color}18`,
                      borderColor: `${community.color}7A`,
                      color: community.color,
                    }
                  : undefined
              }
            >
              <span className={styles.communityDot} style={{ backgroundColor: community.color }} />
              <span>{community.label}</span>
              <span className={styles.communityMeta}>{community.node_count}</span>
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
