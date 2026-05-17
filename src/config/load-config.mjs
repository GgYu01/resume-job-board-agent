import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { DEFAULT_BATCH_POLICY } from "./defaults.mjs";

export function loadYamlFile(file) {
  return YAML.parse(fs.readFileSync(file, "utf8"));
}

export function resolveRoleProfilePath(root, profileId) {
  if (!profileId) return null;
  const asPath = path.resolve(root, String(profileId));
  if (fs.existsSync(asPath)) return asPath;
  const file = path.resolve(root, "configs", "roles", `${profileId}.yaml`);
  if (fs.existsSync(file)) return file;
  throw new Error(`Role profile not found: ${profileId}`);
}

export function loadRoleProfile(root, profileId) {
  const file = resolveRoleProfilePath(root, profileId);
  if (!file) return null;
  const profile = loadYamlFile(file);
  profile.__file = file;
  const validation = validateRoleProfile(profile);
  if (validation.errors.length) {
    throw new Error(`Invalid role profile ${profileId}: ${validation.errors.join("; ")}`);
  }
  profile.__warnings = validation.warnings;
  return profile;
}

export function listRoleProfiles(root) {
  const dir = path.resolve(root, "configs", "roles");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => /\.ya?ml$/i.test(name))
    .map((name) => {
      const file = path.join(dir, name);
      try {
        const profile = loadYamlFile(file);
        return {
          id: profile.id || name.replace(/\.ya?ml$/i, ""),
          label: profile.label || "",
          version: profile.version || null,
          file,
          valid: validateRoleProfile(profile).errors.length === 0,
        };
      } catch (error) {
        return { id: name.replace(/\.ya?ml$/i, ""), label: "", version: null, file, valid: false, error: error.message };
      }
    });
}

export function normalizeTermList(profile, keys) {
  const out = [];
  for (const key of keys) {
    for (const item of Array.isArray(profile?.[key]) ? profile[key] : []) {
      if (typeof item === "string") out.push({ term: item, weight: 8, bucket: key });
      else if (item?.term) out.push({ term: String(item.term), weight: Number(item.weight ?? 8), bucket: key });
    }
  }
  return out;
}

export function positiveTermsFromProfile(profile) {
  return normalizeTermList(profile, ["must_have", "should_have", "nice_to_have"]);
}

export function negativeTermsFromProfile(profile) {
  return normalizeTermList(profile, ["negative"]);
}

export function hardFiltersFromProfile(profile) {
  return profile?.hard_filters && typeof profile.hard_filters === "object" ? profile.hard_filters : {};
}

export function batchPolicyFromProfile(profile) {
  return {
    ...DEFAULT_BATCH_POLICY,
    ...(profile?.batch_policy && typeof profile.batch_policy === "object" ? profile.batch_policy : {}),
  };
}

export function loadBatchPolicy(root) {
  const file = path.resolve(root, "configs", "batch.yaml");
  if (!fs.existsSync(file)) return { ...DEFAULT_BATCH_POLICY };
  return { ...DEFAULT_BATCH_POLICY, ...loadYamlFile(file) };
}

export function validateRoleProfile(profile) {
  const errors = [];
  const warnings = [];
  const validateStringList = (value, key) => {
    if (value === undefined) return;
    if (!Array.isArray(value)) {
      errors.push(`hard_filters.${key} must be a list`);
      return;
    }
    value.forEach((item, index) => {
      if (typeof item !== "string" || !item.trim()) {
        errors.push(`hard_filters.${key}[${index}] must be a non-empty string`);
      }
    });
  };
  if (!profile || typeof profile !== "object") errors.push("profile must be a map");
  if (!profile.id) errors.push("id is required");
  if (!profile.label) warnings.push("label is recommended");
  for (const key of ["must_have", "should_have", "nice_to_have", "negative"]) {
    if (profile[key] === undefined) continue;
    if (!Array.isArray(profile[key])) {
      errors.push(`${key} must be a list`);
      continue;
    }
    for (const [index, item] of profile[key].entries()) {
      if (typeof item === "string") continue;
      if (!item || typeof item !== "object" || !item.term) errors.push(`${key}[${index}] must include term`);
      if (item?.weight !== undefined && !Number.isFinite(Number(item.weight))) errors.push(`${key}[${index}].weight must be numeric`);
    }
  }
  if (profile?.hard_filters !== undefined) {
    const filters = profile.hard_filters;
    if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
      errors.push("hard_filters must be a map");
    } else {
      if (filters.cities !== undefined && !Array.isArray(filters.cities)) errors.push("hard_filters.cities must be a list");
      for (const key of ["reject_internship", "reject_part_time"]) {
        if (filters[key] !== undefined && typeof filters[key] !== "boolean") errors.push(`hard_filters.${key} must be boolean`);
      }
      if (filters.min_salary !== undefined && filters.min_salary !== null && !Number.isFinite(Number(filters.min_salary))) {
        errors.push("hard_filters.min_salary must be numeric or null");
      }
      if (filters.max_experience_years !== undefined && filters.max_experience_years !== null && !Number.isFinite(Number(filters.max_experience_years))) {
        errors.push("hard_filters.max_experience_years must be numeric or null");
      }
      validateStringList(filters.required_any_terms, "required_any_terms");
      validateStringList(filters.reject_terms, "reject_terms");
    }
  }

  if (profile?.review_policy !== undefined) {
    const policy = profile.review_policy;
    if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
      errors.push("review_policy must be a map");
    } else {
      for (const key of ["codex_review_top_n", "codex_review_borderline_n"]) {
        if (policy[key] !== undefined && (!Number.isInteger(Number(policy[key])) || Number(policy[key]) <= 0)) {
          errors.push(`review_policy.${key} must be a positive integer`);
        }
      }
      for (const key of ["require_evidence", "allow_uncertain"]) {
        if (policy[key] !== undefined && typeof policy[key] !== "boolean") errors.push(`review_policy.${key} must be boolean`);
      }
    }
  }

  if (profile?.ranking_policy !== undefined) {
    const policy = profile.ranking_policy;
    if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
      errors.push("ranking_policy must be a map");
    } else if (policy.use_default_terms !== undefined && typeof policy.use_default_terms !== "boolean") {
      errors.push("ranking_policy.use_default_terms must be boolean");
    }
  }

  if (profile?.batch_policy !== undefined) {
    const policy = profile.batch_policy;
    if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
      errors.push("batch_policy must be a map");
    } else {
      if (policy.max_per_batch !== undefined && (!Number.isInteger(Number(policy.max_per_batch)) || Number(policy.max_per_batch) < 1 || Number(policy.max_per_batch) > 20)) {
        errors.push("batch_policy.max_per_batch must be an integer between 1 and 20");
      }
      for (const key of ["batch_cooldown_ms", "jitter_ms"]) {
        if (policy[key] !== undefined && (!Number.isFinite(Number(policy[key])) || Number(policy[key]) < 0)) {
          errors.push(`batch_policy.${key} must be a non-negative number`);
        }
      }
      if (policy.stop_on_access_limited !== undefined && typeof policy.stop_on_access_limited !== "boolean") {
        errors.push("batch_policy.stop_on_access_limited must be boolean");
      }
    }
  }
  return { errors, warnings };
}
