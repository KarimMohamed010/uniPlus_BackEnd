CREATE OR REPLACE PROCEDURE award_points(
    p_student_id INT,
    p_team_id INT,
    p_points_to_add INT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_admin INT;
    v_is_member INT;
    v_current_points INT;
    v_current_type TEXT;
    v_current_usage_num INT;
    v_new_points INT;
    v_new_type TEXT;
    v_new_usage_num INT;
BEGIN
    -- 1. Check Eligibility
    -- a. Check if admin
    --assign 1 if found in admin table
    SELECT 1 INTO v_is_admin FROM admins WHERE id = p_student_id LIMIT 1;
    IF v_is_admin IS NOT NULL THEN
        RETURN;
    END IF;

    -- b. Check if member of any team (Strict check: any record in belong_to)
    --assign 1 if found in belong_to table
    SELECT 1 INTO v_is_member FROM belong_to WHERE student_id = p_student_id LIMIT 1;
    IF v_is_member IS NOT NULL THEN
        RETURN;
    END IF;

    -- 2. Get or Create Badge Entry
    -- Insert default if not exists.
    INSERT INTO badges (student_id, team_id, type_, points, usage_num)
    VALUES (p_student_id, p_team_id, 'Beginner', 0, 0)
    ON CONFLICT (student_id, team_id) DO NOTHING;

    -- Lock the row for update
    SELECT points, type_, usage_num
    INTO v_current_points, v_current_type, v_current_usage_num
    FROM badges
    WHERE student_id = p_student_id AND team_id = p_team_id
    FOR UPDATE;

    -- Handle potential nulls if something went wrong, though assert created above
    IF v_current_points IS NULL THEN
        v_current_points := 0;
    END IF;
    IF v_current_usage_num IS NULL THEN
        v_current_usage_num := 0;
    END IF;
    IF v_current_type IS NULL THEN
        v_current_type := 'Beginner';
    END IF;

    -- 3. Calculate New State
    v_new_points := v_current_points + p_points_to_add;
    v_new_type := v_current_type;
    v_new_usage_num := v_current_usage_num;

    -- Threshold Logic
    IF v_new_points >= 200 THEN
        v_new_type := 'Top Fan';
        v_new_usage_num := 1;
        v_new_points := 0; -- Reset points
    ELSIF v_new_points >= 150 THEN
        v_new_type := 'Star';
        v_new_usage_num := 2;
    ELSIF v_new_points >= 100 THEN
        v_new_type := 'Contributor';
        v_new_usage_num := 3;
    END IF;

    -- 4. Update Database
    UPDATE badges
    SET points = v_new_points,
        type_ = v_new_type,
        usage_num = v_new_usage_num
    WHERE student_id = p_student_id AND team_id = p_team_id;

END;
$$;
