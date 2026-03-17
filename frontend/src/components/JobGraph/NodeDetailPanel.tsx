import { useEffect, useMemo, useState } from "react";
import { Spin } from "antd";
import { ArrowRight, FileSearch, MapPin, Wallet, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { graphApi } from "../../api/graph";
import { jobsApi } from "../../api/jobs";
import { JOB_CATEGORIES } from "../../constants";
import type { JobProfileResponse, RoleResponse } from "../../types/job";
import type { JobNode, JobStats } from "./types";
import styles from "./JobGraph.module.css";

interface NodeDetailPanelProps {
  node: JobNode;
  onClose: () => void;
}

interface DetailState {
  loading: boolean;
  role: RoleResponse | null;
  profile: JobProfileResponse | null;
  stats: JobStats | null;
}

export function NodeDetailPanel({ node, onClose }: NodeDetailPanelProps) {
  const navigate = useNavigate();
  const [state, setState] = useState<DetailState>({
    loading: true,
    role: null,
    profile: null,
    stats: null,
  });

  const categoryMeta = JOB_CATEGORIES[node.category];
  const accentColor = categoryMeta?.color ?? node.color ?? "#4F46E5";

  useEffect(() => {
    let active = true;

    const fetchDetail = async () => {
      setState({
        loading: true,
        role: null,
        profile: null,
        stats: null,
      });

      try {
        const [statsResponse, rolesResponse] = await Promise.all([
          graphApi.getJobStats(node.label),
          jobsApi.getRoles(true),
        ]);

        const role =
          rolesResponse.data.find((item) => item.name === node.label) ?? null;

        let profile: JobProfileResponse | null = null;
        if (role) {
          try {
            const profileResponse = await jobsApi.getRoleProfiles(role.id);
            profile = profileResponse.data.profiles?.[0] ?? null;
          } catch {
            profile = null;
          }
        }

        if (active) {
          setState({
            loading: false,
            role,
            profile,
            stats: statsResponse.data,
          });
        }
      } catch (error) {
        console.error("Failed to fetch job detail:", error);
        if (active) {
          setState({
            loading: false,
            role: null,
            profile: null,
            stats: null,
          });
        }
      }
    };

    void fetchDetail();

    return () => {
      active = false;
    };
  }, [node.label]);

  const topSkills = useMemo(() => {
    const profileJson = state.profile?.profile_json as Record<string, unknown> | undefined;
    const profileSkills = extractTopSkills(profileJson);
    if (profileSkills.length > 0) {
      return profileSkills.slice(0, 5);
    }
    return state.stats?.top_skills ?? [];
  }, [state.profile, state.stats]);

  const jdCount = state.stats?.jd_count ?? node.jd_count ?? 0;
  const salaryText = formatSalaryRange(
    state.stats?.salary_min ?? null,
    state.stats?.salary_max ?? null
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
                backgroundColor: `${accentColor}18`,
                color: accentColor,
              }}
            >
              <span>{categoryMeta.icon}</span>
              <span>{node.category}</span>
            </div>
          ) : null}
        </div>

        <div className={styles.detailSummary}>
          <div className={styles.statCard}>
            <div className={styles.statNumber} style={{ color: accentColor }}>
              {jdCount.toLocaleString()}
            </div>
            <div className={styles.statLabel}>共 {jdCount.toLocaleString()} 条招聘数据</div>
          </div>

          <div className={styles.metaCardGroup}>
            <div className={styles.metaCard}>
              <div className={styles.metaCardLabel}>
                <Wallet size={14} />
                <span>薪资范围</span>
              </div>
              <div className={styles.metaCardValue}>{salaryText}</div>
            </div>

            <div className={styles.metaCard}>
              <div className={styles.metaCardLabel}>
                <MapPin size={14} />
                <span>热门城市</span>
              </div>
              <div className={styles.cityPills}>
                {(state.stats?.top_cities ?? []).length > 0 ? (
                  state.stats?.top_cities.map((city) => (
                    <span key={city} className={styles.softPill}>
                      {city}
                    </span>
                  ))
                ) : (
                  <span className={styles.metaFallback}>暂无数据</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className={styles.detailSection}>
        <div className={styles.sectionHeading}>
          <span
            className={styles.sectionBar}
            style={{ backgroundColor: accentColor }}
          />
          <span className={styles.sectionTitle}>Top Skills</span>
        </div>
        <div className={styles.sectionBody}>
          {topSkills.length > 0 ? (
            <div className={styles.skillPills}>
              {topSkills.map((skill) => (
                <span key={skill} className={styles.skillPill}>
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <div className={styles.metaFallback}>暂无技能数据</div>
          )}
        </div>
      </section>

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
          ) : state.profile ? (
            <ProfileContent
              profile={state.profile.profile_json as Record<string, unknown>}
              accentColor={accentColor}
            />
          ) : (
            <div className={styles.emptyState}>
              <FileSearch size={48} color="#D1D5DB" strokeWidth={1.6} />
              <p className={styles.emptyText}>暂无岗位画像</p>
            </div>
          )}
        </div>
      </section>

      <button
        className={styles.profileAction}
        disabled={!state.role}
        onClick={() => {
          if (state.role) {
            navigate(`/jobs/profiles/${state.role.id}`);
          }
        }}
      >
        <span>查看完整岗位画像</span>
        <ArrowRight size={16} />
      </button>
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

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
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
    return (
      <div className={styles.profileParagraph}>
        {value.map(stringifyValue).join(" · ")}
      </div>
    );
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

function extractTopSkills(
  profileJson?: Record<string, unknown>
): string[] {
  if (!profileJson) {
    return [];
  }

  const skills = new Set<string>();
  const technicalSkills = profileJson.technical_skills;

  if (Array.isArray(technicalSkills)) {
    technicalSkills.forEach((skill) => {
      if (typeof skill === "string") {
        skills.add(skill);
      }
      if (
        skill &&
        typeof skill === "object" &&
        "name" in skill &&
        typeof skill.name === "string"
      ) {
        skills.add(skill.name);
      }
    });
  }

  if (technicalSkills && typeof technicalSkills === "object" && !Array.isArray(technicalSkills)) {
    Object.values(technicalSkills as Record<string, unknown>).forEach((value) => {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (
            item &&
            typeof item === "object" &&
            "name" in item &&
            typeof item.name === "string"
          ) {
            skills.add(item.name);
          }
        });
      }
    });
  }

  return Array.from(skills);
}

function formatSalaryRange(min: number | null, max: number | null): string {
  if (min == null || max == null) {
    return "暂无薪资数据";
  }

  return `¥${min.toLocaleString()} - ¥${max.toLocaleString()} / 月`;
}

function formatKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
