import { useState, useEffect } from "react";
import { Spin, Empty, Card, Tag, Row, Col, Tabs } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import { jobsApi } from "../../api/jobs";
import { JOB_CATEGORIES } from "../../constants";
import type { JobNode } from "./types";
import styles from "./JobGraph.module.css";

interface NodeDetailPanelProps {
  node: JobNode;
  onClose: () => void;
}

export function NodeDetailPanel({ node, onClose }: NodeDetailPanelProps) {
  const [loading, setLoading] = useState(true);
  const [roleData, setRoleData] = useState<{
    role: { id: string; name: string; category: string; job_count: number } | null;
    profile: any;
    jobs: any[];
  }>({
    role: null,
    profile: null,
    jobs: [],
  });

  useEffect(() => {
    fetchRoleData();
  }, [node.label]);

  const fetchRoleData = async () => {
    setLoading(true);
    try {
      // Get roles to find matching role
      const rolesRes = await jobsApi.getRoles(true);
      const role = rolesRes.data.find(
        (r) => r.name === node.label || node.label.includes(r.name)
      );

      if (role) {
        const [profileRes, jobsRes] = await Promise.all([
          jobsApi.getRoleProfiles(role.id),
          jobsApi.getJobsByRole(role.id).catch(() => ({ data: [] })),
        ]);

        setRoleData({
          role,
          profile: profileRes.data.profiles?.[0] || null,
          jobs: jobsRes.data || [],
        });
      } else {
        setRoleData({
          role: null,
          profile: null,
          jobs: [],
        });
      }
    } catch (error) {
      console.error("Failed to fetch role data:", error);
    } finally {
      setLoading(false);
    }
  };

  const categoryMeta = JOB_CATEGORIES[node.category];

  return (
    <div className={styles.detailPane}>
      <div className={styles.detailHeader}>
        <div className={styles.detailTitle}>
          <h3>{node.label}</h3>
          <div className={styles.detailTags}>
            {categoryMeta && (
              <Tag color={categoryMeta.color}>{node.category}</Tag>
            )}
            <Tag>{node.jd_count} 个 JD</Tag>
          </div>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>
          <CloseOutlined />
        </button>
      </div>

      <div className={styles.detailContent}>
        {loading ? (
          <div className={styles.loadingWrapper}>
            <Spin />
          </div>
        ) : roleData.profile ? (
          <Tabs
            defaultActiveKey="profile"
            items={[
              {
                key: "profile",
                label: "画像分析",
                children: <ProfileTab profile={roleData.profile} />,
              },
              {
                key: "jobs",
                label: `关联公司 (${roleData.jobs.length})`,
                children: (
                  <JobsTab jobs={roleData.jobs.slice(0, 20)} />
                ),
              },
            ]}
          />
        ) : (
          <Empty description="暂无画像数据" />
        )}
      </div>
    </div>
  );
}

function ProfileTab({ profile }: { profile: any }) {
  const profileData = profile?.profile_json || {};
  const techSkills = profileData?.technical_skills || [];
  const softSkills = profileData?.soft_skills || [];
  const benefits = profileData?.benefits || [];
  const totalJds = profileData?.total_jds_analyzed || 0;

  return (
    <div className={styles.profileContent}>
      <div className={styles.profileStats}>
        <span>{totalJds} 条 JD</span>
      </div>

      <Card title="技术技能" size="small" className={styles.profileCard}>
        {techSkills.length > 0 ? (
          <div className={styles.skillList}>
            {techSkills.slice(0, 10).map((skill: any, i: number) => (
              <div key={i} className={styles.skillItem}>
                <span>{skill.name}</span>
                <div className={styles.skillBar}>
                  <div
                    className={styles.skillBarFill}
                    style={{ width: `${(skill.frequency_pct || 0)}%` }}
                  />
                </div>
                <span className={styles.skillPct}>
                  {skill.frequency_pct?.toFixed(0) || 0}%
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>

      <Card title="软素养" size="small" className={styles.profileCard}>
        <div className={styles.tagList}>
          {softSkills.map((skill: any, i: number) => (
            <Tag key={i} color="blue">
              {skill.name}
            </Tag>
          ))}
        </div>
      </Card>

      <Card title="福利待遇" size="small" className={styles.profileCard}>
        <div className={styles.tagList}>
          {benefits.slice(0, 8).map((b: any, i: number) => (
            <Tag key={i} color="green">
              {b.name} ({b.frequency})
            </Tag>
          ))}
        </div>
      </Card>
    </div>
  );
}

function JobsTab({ jobs }: { jobs: any[] }) {
  if (jobs.length === 0) {
    return <Empty description="暂无岗位数据" />;
  }

  return (
    <div className={styles.jobsList}>
      {jobs.map((job, i) => (
        <div key={i} className={styles.jobItem}>
          <div className={styles.jobTitle}>{job.title}</div>
          <div className={styles.jobMeta}>
            <Tag>{job.city}</Tag>
            <Tag color="green">
              {job.salary_min
                ? `${Math.round(job.salary_min / 1000)}K-${Math.round(job.salary_max / 1000)}K`
                : "面议"}
            </Tag>
          </div>
        </div>
      ))}
    </div>
  );
}
