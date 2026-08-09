const db = require("../config/db");



// Check whether user can access a student


const checkStudentAccess = (req, student_id, callback) => {

    // SUPER_ADMIN can access everything
    if (req.user.role === "SUPER_ADMIN") {
        return callback(null, true);
    }

    // STUDENT can access only their own report
    if (req.user.role === "STUDENT") {
        return callback(null, Number(req.user.id) === Number(student_id));
    }

    // Department Admin can access students
    // belonging to their managed departments
    if (
        req.user.role === "TEACHER" &&
        Number(req.user.is_department_admin) === 1
    ) {

        db.query(
            `SELECT u.id
             FROM users u
             JOIN student_classes sc
                 ON u.id = sc.student_id
             JOIN classes c
                 ON sc.class_id = c.id
             JOIN department_management dm
                 ON c.department_id = dm.department_id
             WHERE u.id=?
             AND dm.teacher_id=?
             AND u.role='STUDENT'`,
            [
                student_id,
                req.user.id
            ],
            (err, result) => {

                if (err) {
                    return callback(err);
                }

                callback(null, result.length > 0);
            }
        );

        return;
    }

    // Normal Teacher
    // Can access a student only if the student belongs
    // to a class assigned to that teacher
    if (req.user.role === "TEACHER") {

        db.query(
            `SELECT u.id
             FROM users u
             JOIN student_classes sc
                 ON u.id = sc.student_id
             JOIN teacher_assignments ta
                 ON sc.class_id = ta.class_id
             WHERE u.id=?
             AND ta.teacher_id=?
             AND ta.is_active=1`,
            [
                student_id,
                req.user.id
            ],
            (err, result) => {

                if (err) {
                    return callback(err);
                }

                callback(null, result.length > 0);
            }
        );

        return;
    }

    callback(null, false);
};



// Check class access


const checkClassAccess = (req, class_id, callback) => {

    // SUPER_ADMIN
    if (req.user.role === "SUPER_ADMIN") {
        return callback(null, true);
    }

    // Department Admin
    if (
        req.user.role === "TEACHER" &&
        Number(req.user.is_department_admin) === 1
    ) {

        db.query(
            `SELECT c.id
             FROM classes c
             JOIN department_management dm
                 ON c.department_id = dm.department_id
             WHERE c.id=?
             AND dm.teacher_id=?`,
            [
                class_id,
                req.user.id
            ],
            (err, result) => {

                if (err) {
                    return callback(err);
                }

                callback(null, result.length > 0);
            }
        );

        return;
    }

    // Normal Teacher:
    // Can view only classes assigned to them
    if (req.user.role === "TEACHER") {

        db.query(
            `SELECT id
             FROM teacher_assignments
             WHERE class_id=?
             AND teacher_id=?
             AND is_active=1`,
            [
                class_id,
                req.user.id
            ],
            (err, result) => {

                if (err) {
                    return callback(err);
                }

                callback(null, result.length > 0);
            }
        );

        return;
    }

    callback(null, false);
};



// Check subject access


const checkSubjectAccess = (
    req,
    subject_id,
    class_id,
    callback
) => {

    // SUPER_ADMIN
    if (req.user.role === "SUPER_ADMIN") {
        return callback(null, true);
    }

    // Department Admin
    if (
        req.user.role === "TEACHER" &&
        Number(req.user.is_department_admin) === 1
    ) {

        db.query(
            `SELECT s.id
             FROM subjects s
             JOIN classes c
                 ON s.class_id = c.id
             JOIN department_management dm
                 ON c.department_id = dm.department_id
             WHERE s.id=?
             AND s.class_id=?
             AND dm.teacher_id=?`,
            [
                subject_id,
                class_id,
                req.user.id
            ],
            (err, result) => {

                if (err) {
                    return callback(err);
                }

                callback(null, result.length > 0);
            }
        );

        return;
    }

    // Normal Teacher:
    // Can access only their assigned subject/class
    if (req.user.role === "TEACHER") {

        db.query(
            `SELECT id
             FROM teacher_assignments
             WHERE subject_id=?
             AND class_id=?
             AND teacher_id=?
             AND is_active=1`,
            [
                subject_id,
                class_id,
                req.user.id
            ],
            (err, result) => {

                if (err) {
                    return callback(err);
                }

                callback(null, result.length > 0);
            }
        );

        return;
    }

    callback(null, false);
};



// Student Attendance Summary


exports.getStudentAttendanceSummary = (req, res) => {

    const { student_id } = req.params;

    if (!student_id) {
        return res.status(400).json({
            success: false,
            message: "Student ID is required."
        });
    }

    checkStudentAccess(
        req,
        student_id,
        (err, hasAccess) => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have permission to view this student's report."
                });
            }

            const sql = `
                SELECT
                    u.id AS student_id,
                    u.full_name,
                    u.roll_no,

                    COUNT(a.id) AS total_attendance,

                    COALESCE(SUM(
                        CASE
                            WHEN a.status='PRESENT' THEN 1
                            ELSE 0
                        END
                    ), 0) AS present,

                    COALESCE(SUM(
                        CASE
                            WHEN a.status='ABSENT' THEN 1
                            ELSE 0
                        END
                    ), 0) AS absent,

                    COALESCE(SUM(
                        CASE
                            WHEN a.status='LATE' THEN 1
                            ELSE 0
                        END
                    ), 0) AS late,

                    COALESCE(SUM(
                        CASE
                            WHEN a.status='LEAVE' THEN 1
                            ELSE 0
                        END
                    ), 0) AS leave_count,

                    COALESCE(ROUND(
                        SUM(
                            CASE
                                WHEN a.status='PRESENT' THEN 1
                                ELSE 0
                            END
                        ) * 100 / NULLIF(COUNT(a.id), 0),
                        2
                    ), 0) AS presence_percentage,

                    COALESCE(ROUND(
                        SUM(
                            CASE
                                WHEN a.status='ABSENT' THEN 1
                                ELSE 0
                            END
                        ) * 100 / NULLIF(COUNT(a.id), 0),
                        2
                    ), 0) AS absence_percentage,

                    COALESCE(ROUND(
                        SUM(
                            CASE
                                WHEN a.status='LATE' THEN 1
                                ELSE 0
                            END
                        ) * 100 / NULLIF(COUNT(a.id), 0),
                        2
                    ), 0) AS late_percentage,

                    COALESCE(ROUND(
                        SUM(
                            CASE
                                WHEN a.status='LEAVE' THEN 1
                                ELSE 0
                            END
                        ) * 100 / NULLIF(COUNT(a.id), 0),
                        2
                    ), 0) AS leave_percentage

                FROM users u

                LEFT JOIN attendance a
                    ON u.id = a.student_id

                WHERE u.id=?
                AND u.role='STUDENT'

                GROUP BY
                    u.id,
                    u.full_name,
                    u.roll_no
            `;

            db.query(
                sql,
                [student_id],
                (err, results) => {

                    if (err) {
                        console.error(err);

                        return res.status(500).json({
                            success: false,
                            message: "Database Error"
                        });
                    }

                    if (results.length === 0) {
                        return res.status(404).json({
                            success: false,
                            message: "Student not found."
                        });
                    }

                    return res.json({
                        success: true,
                        report: results[0]
                    });

                }
            );

        }
    );
};



// Class Attendance Report


exports.getClassAttendanceReport = (req, res) => {

    const { class_id } = req.params;

    if (!class_id) {
        return res.status(400).json({
            success: false,
            message: "Class ID is required."
        });
    }

    checkClassAccess(
        req,
        class_id,
        (err, hasAccess) => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have permission to view this class report."
                });
            }

            const sql = `
                SELECT
                    u.id AS student_id,
                    u.full_name,
                    u.roll_no,

                    COUNT(a.id) AS total_attendance,

                    COALESCE(SUM(
                        CASE
                            WHEN a.status='PRESENT' THEN 1
                            ELSE 0
                        END
                    ), 0) AS present,

                    COALESCE(SUM(
                        CASE
                            WHEN a.status='ABSENT' THEN 1
                            ELSE 0
                        END
                    ), 0) AS absent,

                    COALESCE(SUM(
                        CASE
                            WHEN a.status='LATE' THEN 1
                            ELSE 0
                        END
                    ), 0) AS late,

                    COALESCE(SUM(
                        CASE
                            WHEN a.status='LEAVE' THEN 1
                            ELSE 0
                        END
                    ), 0) AS leave_count,

                    COALESCE(ROUND(
                        SUM(
                            CASE
                                WHEN a.status='PRESENT' THEN 1
                                ELSE 0
                            END
                        ) * 100 / NULLIF(COUNT(a.id), 0),
                        2
                    ), 0) AS presence_percentage,

                    COALESCE(ROUND(
                        SUM(
                            CASE
                                WHEN a.status='ABSENT' THEN 1
                                ELSE 0
                            END
                        ) * 100 / NULLIF(COUNT(a.id), 0),
                        2
                    ), 0) AS absence_percentage,

                    COALESCE(ROUND(
                        SUM(
                            CASE
                                WHEN a.status='LATE' THEN 1
                                ELSE 0
                            END
                        ) * 100 / NULLIF(COUNT(a.id), 0),
                        2
                    ), 0) AS late_percentage,

                    COALESCE(ROUND(
                        SUM(
                            CASE
                                WHEN a.status='LEAVE' THEN 1
                                ELSE 0
                            END
                        ) * 100 / NULLIF(COUNT(a.id), 0),
                        2
                    ), 0) AS leave_percentage

                FROM student_classes sc

                JOIN users u
                    ON sc.student_id=u.id

                LEFT JOIN attendance a
                    ON u.id=a.student_id

                LEFT JOIN attendance_sessions ats
                    ON a.attendance_session_id=ats.id

                LEFT JOIN teacher_assignments ta
                    ON ats.teacher_assignment_id=ta.id
                    AND ta.class_id=?

                WHERE sc.class_id=?
                AND u.role='STUDENT'
                AND u.is_active=1

                GROUP BY
                    u.id,
                    u.full_name,
                    u.roll_no

                ORDER BY u.roll_no ASC
            `;

            db.query(
                sql,
                [
                    class_id,
                    class_id
                ],
                (err, results) => {

                    if (err) {
                        console.error(err);

                        return res.status(500).json({
                            success: false,
                            message: "Database Error"
                        });
                    }

                    return res.json({
                        success: true,
                        class_id: class_id,
                        report: results
                    });

                }
            );

        }
    );
};



// Subject Attendance Report


exports.getSubjectAttendanceReport = (req, res) => {

    const {
        subject_id,
        class_id
    } = req.params;

    if (!subject_id || !class_id) {
        return res.status(400).json({
            success: false,
            message: "Subject ID and Class ID are required."
        });
    }

    checkSubjectAccess(
        req,
        subject_id,
        class_id,
        (err, hasAccess) => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have permission to view this subject report."
                });
            }

            const sql = `
                SELECT
                    u.id AS student_id,
                    u.full_name,
                    u.roll_no,

                    COUNT(a.id) AS total_attendance,

                    COALESCE(SUM(
                        CASE
                            WHEN a.status='PRESENT' THEN 1
                            ELSE 0
                        END
                    ), 0) AS present,

                    COALESCE(SUM(
                        CASE
                            WHEN a.status='ABSENT' THEN 1
                            ELSE 0
                        END
                    ), 0) AS absent,

                    COALESCE(SUM(
                        CASE
                            WHEN a.status='LATE' THEN 1
                            ELSE 0
                        END
                    ), 0) AS late,

                    COALESCE(SUM(
                        CASE
                            WHEN a.status='LEAVE' THEN 1
                            ELSE 0
                        END
                    ), 0) AS leave_count,

                    COALESCE(ROUND(
                        SUM(
                            CASE
                                WHEN a.status='PRESENT' THEN 1
                                ELSE 0
                            END
                        ) * 100 / NULLIF(COUNT(a.id), 0),
                        2
                    ), 0) AS presence_percentage,

                    COALESCE(ROUND(
                        SUM(
                            CASE
                                WHEN a.status='ABSENT' THEN 1
                                ELSE 0
                            END
                        ) * 100 / NULLIF(COUNT(a.id), 0),
                        2
                    ), 0) AS absence_percentage,

                    COALESCE(ROUND(
                        SUM(
                            CASE
                                WHEN a.status='LATE' THEN 1
                                ELSE 0
                            END
                        ) * 100 / NULLIF(COUNT(a.id), 0),
                        2
                    ), 0) AS late_percentage,

                    COALESCE(ROUND(
                        SUM(
                            CASE
                                WHEN a.status='LEAVE' THEN 1
                                ELSE 0
                            END
                        ) * 100 / NULLIF(COUNT(a.id), 0),
                        2
                    ), 0) AS leave_percentage

                FROM student_classes sc

                JOIN users u
                    ON sc.student_id=u.id

                LEFT JOIN attendance_sessions ats
                    ON ats.id IN (
                        SELECT ats2.id
                        FROM attendance_sessions ats2
                        JOIN teacher_assignments ta2
                            ON ats2.teacher_assignment_id=ta2.id
                        WHERE ta2.subject_id=?
                        AND ta2.class_id=?
                    )

                LEFT JOIN attendance a
                    ON a.attendance_session_id=ats.id
                    AND a.student_id=u.id

                WHERE sc.class_id=?
                AND u.role='STUDENT'
                AND u.is_active=1

                GROUP BY
                    u.id,
                    u.full_name,
                    u.roll_no

                ORDER BY u.roll_no ASC
            `;

            db.query(
                sql,
                [
                    subject_id,
                    class_id,
                    class_id
                ],
                (err, results) => {

                    if (err) {
                        console.error(err);

                        return res.status(500).json({
                            success: false,
                            message: "Database Error"
                        });
                    }

                    return res.json({
                        success: true,
                        subject_id: subject_id,
                        class_id: class_id,
                        report: results
                    });

                }
            );

        }
    );
};



// Teacher Report


exports.getTeacherReport = (req, res) => {

    const { teacher_id } = req.params;

    if (!teacher_id) {
        return res.status(400).json({
            success: false,
            message: "Teacher ID is required."
        });
    }

    // Teacher can see only their own report.
    // Department Admin can see teachers
    // in managed departments.
    if (req.user.role === "TEACHER") {

        if (
            Number(req.user.is_department_admin) !== 1 &&
            Number(req.user.id) !== Number(teacher_id)
        ) {

            return res.status(403).json({
                success: false,
                message: "You do not have permission to view this teacher report."
            });

        }

        if (
            Number(req.user.is_department_admin) === 1 &&
            Number(req.user.id) !== Number(teacher_id)
        ) {

            // Department Admin can view only
            // assignments in departments they manage.
            const sql = `
                SELECT
                    ta.id AS teacher_assignment_id,
                    c.id AS class_id,
                    c.class_name,
                    s.id AS subject_id,
                    s.subject_name,
                    ta.day,
                    ta.start_time,
                    ta.end_time,

                    COUNT(a.id) AS total_attendance,

                    COALESCE(SUM(
                        CASE
                            WHEN a.status='PRESENT' THEN 1
                            ELSE 0
                        END
                    ), 0) AS present,

                    COALESCE(SUM(
                        CASE
                            WHEN a.status='ABSENT' THEN 1
                            ELSE 0
                        END
                    ), 0) AS absent,

                    COALESCE(SUM(
                        CASE
                            WHEN a.status='LATE' THEN 1
                            ELSE 0
                        END
                    ), 0) AS late,

                    COALESCE(SUM(
                        CASE
                            WHEN a.status='LEAVE' THEN 1
                            ELSE 0
                        END
                    ), 0) AS leave_count

                FROM teacher_assignments ta

                JOIN classes c
                    ON ta.class_id=c.id

                JOIN subjects s
                    ON ta.subject_id=s.id

                JOIN department_management dm
                    ON c.department_id=dm.department_id

                LEFT JOIN attendance_sessions ats
                    ON ats.teacher_assignment_id=ta.id

                LEFT JOIN attendance a
                    ON a.attendance_session_id=ats.id

                WHERE ta.teacher_id=?
                AND dm.teacher_id=?
                AND ta.is_active=1

                GROUP BY
                    ta.id,
                    c.id,
                    c.class_name,
                    s.id,
                    s.subject_name,
                    ta.day,
                    ta.start_time,
                    ta.end_time

                ORDER BY
                    c.class_name,
                    s.subject_name
            `;

            return db.query(
                sql,
                [
                    teacher_id,
                    req.user.id
                ],
                (err, results) => {

                    if (err) {
                        console.error(err);

                        return res.status(500).json({
                            success: false,
                            message: "Database Error"
                        });
                    }

                    return res.json({
                        success: true,
                        teacher_id: teacher_id,
                        report: results
                    });
                }
            );
        }
    }

    // SUPER_ADMIN or teacher viewing own report
    const sql = `
        SELECT
            ta.id AS teacher_assignment_id,
            c.id AS class_id,
            c.class_name,
            s.id AS subject_id,
            s.subject_name,
            ta.day,
            ta.start_time,
            ta.end_time,

            COUNT(a.id) AS total_attendance,

            COALESCE(SUM(
                CASE
                    WHEN a.status='PRESENT' THEN 1
                    ELSE 0
                END
            ), 0) AS present,

            COALESCE(SUM(
                CASE
                    WHEN a.status='ABSENT' THEN 1
                    ELSE 0
                END
            ), 0) AS absent,

            COALESCE(SUM(
                CASE
                    WHEN a.status='LATE' THEN 1
                    ELSE 0
                END
            ), 0) AS late,

            COALESCE(SUM(
                CASE
                    WHEN a.status='LEAVE' THEN 1
                    ELSE 0
                END
            ), 0) AS leave_count

        FROM teacher_assignments ta

        JOIN classes c
            ON ta.class_id=c.id

        JOIN subjects s
            ON ta.subject_id=s.id

        LEFT JOIN attendance_sessions ats
            ON ats.teacher_assignment_id=ta.id

        LEFT JOIN attendance a
            ON a.attendance_session_id=ats.id

        WHERE ta.teacher_id=?
        AND ta.is_active=1

        GROUP BY
            ta.id,
            c.id,
            c.class_name,
            s.id,
            s.subject_name,
            ta.day,
            ta.start_time,
            ta.end_time

        ORDER BY
            c.class_name,
            s.subject_name
    `;

    db.query(
        sql,
        [teacher_id],
        (err, results) => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            return res.json({
                success: true,
                teacher_id: teacher_id,
                report: results
            });

        }
    );
};