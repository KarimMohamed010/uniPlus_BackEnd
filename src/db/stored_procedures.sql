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

    -- 2. Get or Create Badge Entry in subscribe table
    -- Insert default if not exists.
    INSERT INTO subscribe (user_id, team_id, type_, points, usage_num)
    VALUES (p_student_id, p_team_id, 'Beginner', 0, 0)
    ON CONFLICT (user_id, team_id) DO NOTHING;

    -- Lock the row for update
    SELECT points, type_, usage_num
    INTO v_current_points, v_current_type, v_current_usage_num
    FROM subscribe
    WHERE user_id = p_student_id AND team_id = p_team_id
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
        v_new_type := 'top fan';
        v_new_usage_num := 1;
        v_new_points := 0; -- Reset points
    ELSIF v_new_points >= 150 THEN
        v_new_type := 'old star';
        v_new_usage_num := 2;
    ELSIF v_new_points >= 100 THEN
        v_new_type := 'rising star';
        v_new_usage_num := 3;
    END IF;

    -- 4. Update Database (subscribe table)
    UPDATE subscribe
    SET points = v_new_points,
        type_ = v_new_type,
        usage_num = v_new_usage_num
    WHERE user_id = p_student_id AND team_id = p_team_id;

END;
$$;

CREATE OR REPLACE PROCEDURE get_reported_posts(
    p_team_id INT,
    INOUT p_result REFCURSOR
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT 
        p.id AS post_id,
        (u.fname || ' ' || u.lname)::TEXT AS creator_name,
        u.email AS creator_email,
        p.issued_at AS published_at,
        COUNT(r.post_id)::BIGINT AS report_count
    FROM reports r
    JOIN posts p ON r.post_id = p.id
    JOIN create_post cp ON p.id = cp.post_id
    JOIN users u ON cp.user_id = u.id
    WHERE cp.team_id = p_team_id
    GROUP BY p.id, u.fname, u.lname, u.email, p.issued_at
    HAVING COUNT(r.post_id) > 0
    ORDER BY report_count DESC, p.issued_at DESC;
END;
$$;

CREATE OR REPLACE PROCEDURE mark_all_messages_as_read(p_user_id INT)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE messages
    SET seen = TRUE
    WHERE receiver_id = p_user_id AND seen = FALSE;
END;
$$;


CREATE OR REPLACE PROCEDURE get_all_speakers(
    INOUT p_result REFCURSOR
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM speakers;
END;
$$;

CREATE OR REPLACE PROCEDURE get_all_rooms(
    INOUT p_result REFCURSOR
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM rooms;
END;
$$;

CREATE OR REPLACE PROCEDURE transfer_leadership_before_deletion(p_old_leader_id INT)
LANGUAGE plpgsql
AS $$
DECLARE
    team_rec RECORD;
    v_new_leader_id INT;
BEGIN
    FOR team_rec IN SELECT id FROM teams WHERE leader_id = p_old_leader_id LOOP
        SELECT student_id INTO v_new_leader_id
        FROM belong_to
        WHERE team_id = team_rec.id AND role = 'organizer'
        ORDER BY RANDOM()
        LIMIT 1;

        IF v_new_leader_id IS NOT NULL THEN
            UPDATE teams SET leader_id = v_new_leader_id WHERE id = team_rec.id;
        ELSE
            UPDATE teams SET leader_id = NULL WHERE id = team_rec.id;
        END IF;
    END LOOP;
END;
$$;



CREATE OR REPLACE PROCEDURE get_all_speakers(
    INOUT p_result REFCURSOR
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM speakers;
END;
$$;

CREATE OR REPLACE PROCEDURE get_all_rooms(
    INOUT p_result REFCURSOR
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM rooms;
END;
$$;


CREATE OR REPLACE PROCEDURE mark_all_messages_as_read(p_user_id INT)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE messages
    SET seen = TRUE
    WHERE receiver_id = p_user_id AND seen = FALSE;
END;
$$;