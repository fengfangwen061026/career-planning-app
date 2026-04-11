import { useEffect, useMemo, useState } from "react";
import { Spin } from "antd";
import { ArrowRight, FileSearch, MapPin, Wallet, X, Shuffle, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { graphApi } from "../../api/graph";
import { jobsApi } from "../../api/jobs";
import type { JobProfileResponse } from "../../types/job";
import type { JobNode, JobStats, RoleRelation } from "./types";
import styles from "./JobGraph.module.css";

interface NodeDetailPanelProps {
  node: JobNode;
  transitions: RoleRelation[];
  verticals: RoleRelation[];
  onClose: () => void;
}

interface DetailState {
  loading: boolean;
  profile: JobProfileResponse | null;
  stats: JobStats | null;
}

interface SkillItem {
  name: string;
  category?: string;
  importance?: string;
  frequency_pct?: number;
  evidence?: string;
}

interface CertificationItem {
  name: string;
  required?: boolean;
}

const PROFILE_LABELS: Record<string, string> = {
  role_name: "岗位名称",
  summary: "岗位概述",
  basic_requirements: "基础要求",
  education: "学历要求",
  majors: "相关专业",
  experience_years: "经验年限",
  min: "最低要求",
  preferred: "优先条件",
  certifications: "证书要求",
  technical_skills: "技术技能",
  soft_competencies: "软技能要求",
  soft_skills: "软技能",
  development_potential: "发展潜力",
  growth_indicators: "成长方向",
  learning_requirements: "学习要求",
  innovation_signals: "创新信号",
  salary_range: "薪资范围",
  entry_level: "初级阶段",
  experienced: "熟练阶段",
  senior: "高级阶段",
  evidence_summary: "证据摘要",
  name: "名称",
  category: "类别",
  importance: "重要程度",
  frequency_pct: "出现频率",
  evidence: "依据",
  current: "当前情况",
  required: "目标要求",
  priority: "优先级",
  suggestion: "建议",
  top_skills: "核心技能",
};

export function NodeDetailPanel({
  node,
  transitions,
  verticals,
  onClose,
}: NodeDetailPanelProps) {
  const navigate = useNavigate();
  const [state, setState] = useState<DetailState>({
    loading: true,
    profile: null,
    stats: null,
  });

  const accentColor = node.color ?? "#4F46E5";

  useEffect(() => {
    let active = true;

    const fetchDetail = async () => {
      setState({
        loading: true,
        profile: null,
        stats: null,
      });

      try {
        const [statsResponse, profileResponse] = await Promise.all([
          graphApi.getJobStats(node.label),
          jobsApi.getRoleProfiles(node.role_id).catch(() => null),
        ]);

        const profile = profileResponse?.data.profiles?.[0] ?? null;

        if (active) {
          setState({
            loading: false,
            profile,
            stats: statsResponse.data,
          });
        }
      } catch (error) {
        console.error("Failed to fetch job detail:", error);
        if (active) {
          setState({
            loading: false,
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
  }, [node.label, node.role_id]);

  const topSkills = useMemo(() => {
    const profileJson = state.profile?.profile_json as Record<string, unknown> | undefined;
    const profileSkills = extractTopSkills(profileJson);
    if (profileSkills.length > 0) {
      return profileSkills.slice(0, 5);
    }
    return state.stats?.top_skills ?? [];
  }, [state.profile, state.stats]);

  const jdCount = state.stats?.jd_count ?? node.job_count ?? 0;
  const salaryText = formatSalaryRange(
    state.stats?.salary_min ?? null,
    state.stats?.salary_max ?? null
  );

  const horizontalRelations = useMemo(
    () =>
      transitions
        .slice()
        .sort((left, right) => right.edge.weight - left.edge.weight)
        .slice(0, 4),
    [transitions]
  );

  const verticalRelations = useMemo(
    () =>
      verticals
        .slice()
        .sort((left, right) => right.edge.weight - left.edge.weight)
        .slice(0, 3),
    [verticals]
  );

  return (
    <div className={styles.detailPanel}>
      <button className={styles.closeBtn} onClick={onClose} aria-label="关闭详情面板">
        <X size={16} />
      </button>

      <header className={styles.detailHeader}>
        <div className={styles.detailTitleWrap}>
          <h2 className={styles.detailTitle}>{node.label}</h2>
          <div
            className={styles.categoryPill}
            style={{
              backgroundColor: `${accentColor}18`,
              color: accentColor,
            }}
          >
            <span className={styles.communityDot} style={{ backgroundColor: accentColor }} />
            <span>{`关系簇 ${node.community_id.replace("community:", "").padStart(2, "0")}`}</span>
          </div>
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
          <span className={styles.sectionTitle}>核心技能</span>
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

      <section className={styles.detailSection}>
        <div className={styles.sectionHeading}>
          <span
            className={styles.sectionBar}
            style={{ backgroundColor: "#10B981" }}
          />
          <span className={styles.sectionTitle}>横向换岗路径</span>
          <span className={styles.sectionBadge}>实线表示强关联换岗</span>
        </div>

        <div className={styles.sectionBody}>
          {horizontalRelations.length > 0 ? (
            <div className={styles.transitionList}>
              {horizontalRelations.map((relation) => (
                <div key={relation.edge.id} className={styles.transitionItem}>
                  <div className={styles.transitionHeader}>
                    <Shuffle size={14} className={styles.transitionIcon} />
                    <span className={styles.transitionTarget}>{relation.node.label}</span>
                    <span className={styles.transitionOverlap}>
                      {Math.round(relation.edge.weight * 100)}% 关联
                    </span>
                  </div>
                  <div className={styles.transitionAdvice}>
                    {relation.edge.reasons[0] ?? "岗位能力谱相邻，可作为横向换岗备选"}
                  </div>
                  {relation.edge.gap_skills.length > 0 && (
                    <div className={styles.transitionGap}>
                      <span className={styles.gapLabel}>需补充：</span>
                      {relation.edge.gap_skills.slice(0, 5).map((skill) => (
                        <span key={skill} className={styles.gapSkill}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                  {relation.edge.shared_skills.length > 0 && (
                    <div className={styles.transitionShared}>
                      <span className={styles.sharedLabel}>可迁移：</span>
                      {relation.edge.shared_skills.slice(0, 4).map((skill) => (
                        <span key={skill} className={styles.sharedSkill}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                  {relation.edge.reasons.length > 1 ? (
                    <div className={styles.transitionReasonList}>
                      {relation.edge.reasons.slice(1).map((reason) => (
                        <span key={reason} className={styles.transitionReason}>
                          {reason}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <Shuffle size={36} color="#D1D5DB" strokeWidth={1.6} />
              <p className={styles.emptyText}>暂无换岗路径数据</p>
            </div>
          )}
        </div>
      </section>

      <section className={styles.detailSection}>
        <div className={styles.sectionHeading}>
          <span
            className={styles.sectionBar}
            style={{ backgroundColor: "#7C6DC8" }}
          />
          <span className={styles.sectionTitle}>晋升方向</span>
          <span
            className={styles.sectionBadge}
            style={{ background: "rgba(124, 109, 200, 0.12)", color: "#7C6DC8" }}
          >
            虚线表示成长递进
          </span>
        </div>

        <div className={styles.sectionBody}>
          {verticalRelations.length > 0 ? (
            <div className={styles.transitionList}>
              {verticalRelations.map((relation) => (
                <div key={relation.edge.id} className={styles.transitionItem}>
                  <div className={styles.transitionHeader}>
                    <TrendingUp size={14} className={styles.transitionIcon} />
                    <span className={styles.transitionTarget}>{relation.node.label}</span>
                    <span className={styles.transitionOverlap}>
                      {Math.round(relation.edge.weight * 100)}% 递进
                    </span>
                  </div>
                  <div className={styles.transitionAdvice}>
                    {relation.edge.reasons[0] ?? "适合作为同社区内的成长方向"}
                  </div>
                  {relation.edge.shared_skills.length > 0 ? (
                    <div className={styles.transitionShared}>
                      <span className={styles.sharedLabel}>延续能力：</span>
                      {relation.edge.shared_skills.slice(0, 4).map((skill) => (
                        <span key={skill} className={styles.sharedSkill}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <TrendingUp size={36} color="#D1D5DB" strokeWidth={1.6} />
              <p className={styles.emptyText}>当前社区暂无清晰晋升方向</p>
            </div>
          )}
        </div>
      </section>

      <button
        className={styles.profileAction}
        disabled={!node.role_id}
        onClick={() => navigate(`/jobs/profiles/${node.role_id}`)}
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
          <div className={styles.profileBlockBody}>{renderProfileValue(value, key)}</div>
        </section>
      ))}
    </div>
  );
}

function renderProfileValue(value: unknown, fieldKey?: string): JSX.Element {
  const normalizedValue = normalizeJsonValue(value);

  if (normalizedValue == null) {
    return <div className={styles.profileMuted}>暂无数据</div>;
  }

  if (isCertificationList(normalizedValue) || fieldKey === "certifications") {
    return renderCertifications(normalizedValue);
  }

  if (isTechnicalSkillList(normalizedValue) || fieldKey === "technical_skills") {
    return renderTechnicalSkills(normalizedValue);
  }

  if (isSoftSkillList(normalizedValue) || fieldKey === "soft_skills" || fieldKey === "soft_competencies") {
    return renderSoftSkills(normalizedValue);
  }

  if (
    typeof normalizedValue === "string" ||
    typeof normalizedValue === "number" ||
    typeof normalizedValue === "boolean"
  ) {
    return <div className={styles.profileParagraph}>{String(normalizedValue)}</div>;
  }

  if (Array.isArray(normalizedValue)) {
    if (normalizedValue.length === 0) {
      return <div className={styles.profileMuted}>暂无数据</div>;
    }

    if (normalizedValue.every(isPrimitiveValue)) {
      return (
        <div className={styles.profileTagList}>
          {normalizedValue.map((item, index) => (
            <span key={`${item}-${index}`} className={styles.profileTag}>
              {String(item)}
            </span>
          ))}
        </div>
      );
    }

    return (
      <div className={styles.profileList}>
        {normalizedValue.map((item, index) => (
          <div key={index} className={styles.profileListItem}>
            {renderProfileValue(item)}
          </div>
        ))}
      </div>
    );
  }

  if (typeof normalizedValue === "object") {
    return (
      <div className={styles.profileKvList}>
        {Object.entries(normalizedValue as Record<string, unknown>).map(([subKey, subValue]) => {
          const nestedValue = normalizeJsonValue(subValue);
          const complex =
            Array.isArray(nestedValue) ||
            (nestedValue !== null && typeof nestedValue === "object");

          return (
            <div
              key={subKey}
              className={`${styles.profileKvRow} ${complex ? styles.profileKvRowStacked : ""}`}
            >
              <span className={styles.profileKvKey}>{formatKey(subKey)}</span>
              <div className={styles.profileKvValue}>{renderProfileValue(nestedValue, subKey)}</div>
            </div>
          );
        })}
      </div>
    );
  }

  return <div className={styles.profileParagraph}>{String(normalizedValue)}</div>;
}

function renderTechnicalSkills(value: unknown): JSX.Element {
  const skills = normalizeSkillList(value);
  if (skills.length === 0) {
    return <div className={styles.profileMuted}>暂无技能数据</div>;
  }

  return (
    <div className={styles.skillRowList}>
      {skills.map((skill, index) => (
        <div
          key={`${skill.name}-${index}`}
          className={styles.skillRow}
        >
          <span className={styles.skillName}>{skill.name}</span>
          {skill.category ? (
            <span className={styles.skillMetaTag}>{skill.category}</span>
          ) : null}
          {skill.importance ? (
            <span
              className={`${styles.skillImportanceTag} ${getImportanceClass(skill.importance)}`}
            >
              {getImportanceSymbol(skill.importance)} {normalizeImportanceLabel(skill.importance)}
            </span>
          ) : null}
          <span className={styles.skillFrequency}>
            {skill.frequency_pct != null ? `${skill.frequency_pct}%` : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

function renderSoftSkills(value: unknown): JSX.Element {
  const skills = normalizeSkillList(value);
  if (skills.length === 0) {
    return <div className={styles.profileMuted}>暂无技能数据</div>;
  }

  return (
    <div className={styles.softSkillList}>
      {skills.map((skill, index) => (
        <span
          key={`${skill.name}-${index}`}
          className={`${styles.softSkillTag} ${getSoftSkillClass(skill.importance)}`}
          title={skill.evidence ?? ""}
        >
          {getImportanceSymbol(skill.importance)} {skill.name}
        </span>
      ))}
    </div>
  );
}

function renderCertifications(value: unknown): JSX.Element {
  const certs = normalizeCertificationList(value);
  if (certs.length === 0) {
    return <div className={styles.profileMuted}>暂无数据</div>;
  }

  return (
    <div className={styles.certificationList}>
      {certs.map((cert, index) => (
        <span
          key={`${cert.name}-${index}`}
          className={`${styles.certTag} ${cert.required ? styles.certRequired : styles.certOptional}`}
        >
          {cert.name}
          {cert.required ? "" : "（选修）"}
        </span>
      ))}
    </div>
  );
}

function normalizeJsonValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith("{") && trimmed.endsWith("}"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }

  return value;
}

function isPrimitiveValue(value: unknown): boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function normalizeSkillList(value: unknown): SkillItem[] {
  const normalized = normalizeJsonValue(value);
  if (
    normalized &&
    typeof normalized === "object" &&
    !Array.isArray(normalized) &&
    Object.values(normalized as Record<string, unknown>).every(
      (item) => item && typeof item === "object" && !Array.isArray(item)
    )
  ) {
    return Object.entries(normalized as Record<string, Record<string, unknown>>).map(
      ([key, item]) => ({
        name: formatKey(key),
        importance:
          typeof item.importance === "string"
            ? item.importance
            : typeof item.value === "number"
              ? `${item.value}/5`
              : undefined,
        evidence: typeof item.evidence === "string" ? item.evidence : undefined,
      })
    );
  }

  if (!Array.isArray(normalized)) {
    return [];
  }

  return normalized
    .map((item) => normalizeJsonValue(item))
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      name:
        typeof item.name === "string"
          ? item.name
          : typeof item.skill_name === "string"
            ? item.skill_name
            : "未命名技能",
      category: typeof item.category === "string" ? item.category : undefined,
      importance: typeof item.importance === "string" ? item.importance : undefined,
      frequency_pct:
        typeof item.frequency_pct === "number"
          ? item.frequency_pct
          : typeof item.weight === "number"
            ? Math.round(item.weight * 100)
            : typeof item.frequency_pct === "string"
              ? Number(item.frequency_pct.replace("%", ""))
            : undefined,
      evidence:
        typeof item.evidence === "string"
          ? item.evidence
          : typeof item.proficiency_evidence === "string"
            ? item.proficiency_evidence
            : undefined,
    }));
}

function normalizeCertificationList(value: unknown): CertificationItem[] {
  const normalized = normalizeJsonValue(value);
  if (!Array.isArray(normalized)) {
    return [];
  }

  return normalized
    .map((item) => normalizeJsonValue(item))
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      name: typeof item.name === "string" ? item.name : "未命名证书",
      required: Boolean(item.required),
    }));
}

function isTechnicalSkillList(value: unknown): boolean {
  const skills = normalizeSkillList(value);
  return skills.length > 0 && skills.some((skill) => skill.frequency_pct != null || skill.category || skill.importance);
}

function isSoftSkillList(value: unknown): boolean {
  const skills = normalizeSkillList(value);
  return skills.length > 0 && skills.some((skill) => Boolean(skill.evidence));
}

function isCertificationList(value: unknown): boolean {
  return normalizeCertificationList(value).length > 0;
}

function extractTopSkills(profileJson?: Record<string, unknown>): string[] {
  if (!profileJson) {
    return [];
  }

  const skills = normalizeSkillList(profileJson.technical_skills);
  return skills.map((skill) => skill.name);
}

function formatSalaryRange(min: number | null, max: number | null): string {
  if (min == null || max == null) {
    return "暂无薪资数据";
  }

  return `¥${min.toLocaleString()} - ¥${max.toLocaleString()} / 月`;
}

function formatKey(key: string): string {
  return PROFILE_LABELS[key] ?? key.replace(/_/g, " ");
}

function getImportanceClass(importance?: string): string {
  const label = normalizeImportanceLabel(importance);
  if (label === "必备") return styles.skillImportanceRequired;
  if (label === "优先") return styles.skillImportancePreferred;
  return styles.skillImportanceBonus;
}

function getSoftSkillClass(importance?: string): string {
  const label = normalizeImportanceLabel(importance);
  if (label === "核心素养") return styles.softSkillCore;
  if (label === "重要") return styles.softSkillImportant;
  return styles.softSkillBonus;
}

function getImportanceSymbol(importance?: string): string {
  const label = normalizeImportanceLabel(importance);
  if (label === "必备" || label === "核心素养") return "●";
  if (label === "优先" || label === "重要") return "○";
  return "·";
}

function normalizeImportanceLabel(importance?: string): string {
  if (!importance) return "加分";
  if (importance.includes("必备")) return "必备";
  if (importance.includes("优先")) return "优先";
  if (importance.includes("核心")) return "核心素养";
  if (importance.includes("重要")) return "重要";
  if (importance.includes("加分")) return "加分";
  if (importance.includes("了解")) return "加分";
  return importance;
}
