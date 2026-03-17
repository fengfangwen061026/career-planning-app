import { useEffect, useMemo, useState } from "react";
import { Spin } from "antd";
import { FileSearch, X } from "lucide-react";
import { jobsApi } from "../../api/jobs";
import { JOB_CATEGORIES } from "../../constants";
import type { JobProfileResponse, RoleResponse } from "../../types/job";
import type { JobNode } from "./types";
import styles from "./JobGraph.module.css";

interface NodeDetailPanelProps {
  node: JobNode;
  onClose: () => void;
}

interface DetailState {
  loading: boolean;
  role: RoleResponse | null;
  profile: JobProfileResponse | null;
  hasProfile: boolean;
}

export function NodeDetailPanel({ node, onClose }: NodeDetailPanelProps) {
  const [state, setState] = useState<DetailState>({
    loading: true,
    role: null,
    profile: null,
    hasProfile: false,
  });

  const categoryMeta = JOB_CATEGORIES[node.category];
  const accentColor = categoryMeta?.color ?? node.color ?? "#4F46E5";
  const accentTint = `${accentColor}18`;

  useEffect(() => {
    let active = true;

    const fetchProfile = async () => {
      setState({
        loading: true,
        role: null,
        profile: null,
        hasProfile: false,
      });

      try {
        const rolesResponse = await jobsApi.getRoles(true);
        const role =
          rolesResponse.data.find((item) => item.name === node.label) ?? null;

        if (!role) {
          if (active) {
            setState({
              loading: false,
              role: null,
              profile: null,
              hasProfile: false,
            });
          }
          return;
        }

        try {
          const profileResponse = await jobsApi.getRoleProfiles(role.id);
          const latestProfile = profileResponse.data.profiles?.[0] ?? null;

          if (active) {
            setState({
              loading: false,
              role,
              profile: latestProfile,
              hasProfile: Boolean(latestProfile),
            });
          }
        } catch {
          if (active) {
            setState({
              loading: false,
              role,
              profile: null,
              hasProfile: false,
            });
          }
        }
      } catch (error) {
        console.error("Failed to fetch job profile:", error);
        if (active) {
          setState({
            loading: false,
            role: null,
            profile: null,
            hasProfile: false,
          });
        }
      }
    };

    void fetchProfile();

    return () => {
      active = false;
    };
  }, [node.label]);

  const profileJson = useMemo(
    () => (state.profile?.profile_json as Record<string, unknown> | undefined) ?? null,
    [state.profile]
  );

  return (
    <div className={styles.detailPanel}>
      <button className={styles.closeBtn} onClick={onClose} aria-label="关闭详情面板">
        <X size={16} />
      </button>

      <header className={styles.detailHeader}>
        <div className={styles.detailTitleWrap}>
          <h2 className={styles.detailTitle}>{node.label}</h2>
          {categoryMeta ? (
            <div
              className={styles.categoryPill}
              style={{
                backgroundColor: accentTint,
                color: accentColor,
              }}
            >
              <span>{categoryMeta.icon}</span>
              <span>{node.category}</span>
            </div>
          ) : null}
        </div>

        <div className={styles.statCard}>
          <div className={styles.statNumber} style={{ color: accentColor }}>
            {node.jd_count ?? 0}
          </div>
          <div className={styles.statLabel}>条招聘数据</div>
        </div>
      </header>

      <section className={styles.detailSection}>
        <div className={styles.sectionHeading}>
          <span
            className={styles.sectionBar}
            style={{ backgroundColor: accentColor }}
          />
          <span className={styles.sectionTitle}>岗位画像</span>
        </div>

        <div className={styles.sectionBody}>
          {state.loading ? (
            <div className={styles.loadingWrapper}>
              <Spin />
            </div>
          ) : state.hasProfile && profileJson ? (
            <ProfileContent profile={profileJson} accentColor={accentColor} />
          ) : (
            <div className={styles.emptyState}>
              <FileSearch size={48} color="#D1D5DB" strokeWidth={1.6} />
              <p className={styles.emptyText}>暂无岗位画像</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ProfileContent({
  profile,
  accentColor,
}: {
  profile: Record<string, unknown>;
  accentColor: string;
}) {
  return (
    <div className={styles.profileBlocks}>
      {Object.entries(profile).map(([key, value]) => (
        <section key={key} className={styles.profileBlock}>
          <h3 className={styles.profileBlockTitle} style={{ color: accentColor }}>
            {formatKey(key)}
          </h3>
          <div className={styles.profileBlockBody}>{renderProfileValue(value)}</div>
        </section>
      ))}
    </div>
  );
}

function renderProfileValue(value: unknown): JSX.Element {
  if (value == null) {
    return <div className={styles.profileMuted}>暂无数据</div>;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <div className={styles.profileParagraph}>{String(value)}</div>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <div className={styles.profileMuted}>暂无数据</div>;
    }

    if (value.every((item) => typeof item === "string" || typeof item === "number")) {
      return (
        <div className={styles.profileTagList}>
          {value.map((item, index) => (
            <span key={`${item}-${index}`} className={styles.profileTag}>
              {String(item)}
            </span>
          ))}
        </div>
      );
    }

    return (
      <div className={styles.profileList}>
        {value.map((item, index) => (
          <div key={index} className={styles.profileListItem}>
            {renderObjectOrPrimitive(item)}
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    return (
      <div className={styles.profileKvList}>
        {Object.entries(value as Record<string, unknown>).map(([subKey, subValue]) => (
          <div key={subKey} className={styles.profileKvRow}>
            <span className={styles.profileKvKey}>{formatKey(subKey)}</span>
            <div className={styles.profileKvValue}>{renderObjectOrPrimitive(subValue)}</div>
          </div>
        ))}
      </div>
    );
  }

  return <div className={styles.profileParagraph}>{String(value)}</div>;
}

function renderObjectOrPrimitive(value: unknown): JSX.Element {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return (
      <div className={styles.profileInlineGrid}>
        {Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => (
          <div key={key} className={styles.profileInlineItem}>
            <span className={styles.profileInlineKey}>{formatKey(key)}</span>
            <span className={styles.profileInlineValue}>{stringifyValue(nestedValue)}</span>
          </div>
        ))}
      </div>
    );
  }

  if (Array.isArray(value)) {
    return <div className={styles.profileParagraph}>{value.map(stringifyValue).join(" · ")}</div>;
  }

  return <div className={styles.profileParagraph}>{stringifyValue(value)}</div>;
}

function stringifyValue(value: unknown): string {
  if (value == null) return "暂无";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(stringifyValue).join(" · ");
  }
  return JSON.stringify(value);
}

function formatKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
