use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleplayProjectSummary {
    pub id: String,
    pub name: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub status: String,
    pub segment_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleplayProject {
    pub id: String,
    pub name: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub doc_json: String,
    pub palette_json: String,
    pub timeline_json: String,
    pub status: String,
    #[serde(default)]
    pub segments: Vec<RoleplaySegment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleplaySegment {
    pub id: String,
    pub project_id: String,
    pub order_index: i64,
    pub text: String,
    pub voice_profile_id: String,
    pub color: String,
    #[serde(default)]
    pub generation_id: Option<String>,
    pub status: String,
    #[serde(default)]
    pub retry_count: i64,
    #[serde(default)]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveRoleplayProjectReq {
    pub id: String,
    pub name: String,
    pub doc_json: String,
    pub palette_json: String,
    pub timeline_json: String,
    pub status: String,
    pub segments: Vec<RoleplaySegmentInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleplaySegmentInput {
    pub id: String,
    pub order_index: i64,
    pub text: String,
    pub voice_profile_id: String,
    pub color: String,
}

pub const PROJECT_STATUS_DRAFT: &str = "draft";
pub const PROJECT_STATUS_GENERATING: &str = "generating";
pub const PROJECT_STATUS_STUDIO: &str = "studio";

pub const SEG_STATUS_PENDING: &str = "pending";
pub const SEG_STATUS_QUEUED: &str = "queued";
pub const SEG_STATUS_GENERATING: &str = "generating";
pub const SEG_STATUS_DONE: &str = "done";
pub const SEG_STATUS_FAILED: &str = "failed";
