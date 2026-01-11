# AI Courses Database Migration

Run these SQL statements in Supabase SQL Editor.

## Tables

```sql
-- Table for storing course links to be processed
CREATE TABLE IF NOT EXISTS course_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    title TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'error', 'published')),
    error_message TEXT,
    created_by UUID REFERENCES admin_users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for storing AI-generated courses
CREATE TABLE IF NOT EXISTS ai_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id UUID REFERENCES course_links(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '📚',
    difficulty TEXT DEFAULT 'intermediate' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced', 'expert')),
    duration TEXT DEFAULT '2-4 horas',
    content JSONB NOT NULL,
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    total_views INTEGER DEFAULT 0,
    ai_model TEXT DEFAULT 'gemini-2.0-flash',
    credits_used INTEGER DEFAULT 0,
    generation_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_course_links_status ON course_links(status);
CREATE INDEX IF NOT EXISTS idx_ai_courses_published ON ai_courses(is_published);
CREATE INDEX IF NOT EXISTS idx_ai_courses_slug ON ai_courses(slug);
```

## Triggers

```sql
CREATE OR REPLACE FUNCTION update_course_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS course_links_updated ON course_links;
CREATE TRIGGER course_links_updated
    BEFORE UPDATE ON course_links
    FOR EACH ROW
    EXECUTE FUNCTION update_course_timestamp();

DROP TRIGGER IF EXISTS ai_courses_updated ON ai_courses;
CREATE TRIGGER ai_courses_updated
    BEFORE UPDATE ON ai_courses
    FOR EACH ROW
    EXECUTE FUNCTION update_course_timestamp();
```

## RLS Policies

```sql
ALTER TABLE course_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_course_links_policy ON course_links
    FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

CREATE POLICY admin_ai_courses_policy ON ai_courses
    FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

CREATE POLICY public_read_courses ON ai_courses
    FOR SELECT TO anon
    USING (is_published = true);

GRANT ALL ON course_links TO authenticated;
GRANT ALL ON ai_courses TO authenticated;
GRANT SELECT ON ai_courses TO anon;
```

## Content JSON Structure

```json
{
  "intro": "Course introduction text with hacker style",
  "objectives": ["objective1", "objective2"],
  "modules": [
    {
      "id": "module-1",
      "title": "Module Title",
      "sections": [
        {
          "title": "Section Title",
          "theory": "Deep theoretical content...",
          "commands": [
            {"command": "nmap -sV target", "explanation": "..."}
          ],
          "tips": ["Pro tip 1", "Pro tip 2"]
        }
      ]
    }
  ],
  "resources": [{"title": "...", "url": "..."}],
  "conclusion": "Final summary"
}
```
