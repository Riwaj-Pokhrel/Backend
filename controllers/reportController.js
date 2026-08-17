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



// ======================================
// Helper: Convert rows to CSV text
// ======================================
//
// Escapes any field containing a comma, quote, or newline by
// wrapping it in quotes and doubling internal quotes, per the
// standard CSV escaping rule. Excel opens this directly.


const escapeCsvField = (value) => {

    if (value === null || value === undefined) {
        return "";
    }

    const stringValue = String(value);

    if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
};


const rowsToCsv = (headers, rows) => {

    const headerLine = headers
        .map(escapeCsvField)
        .join(",");

    const dataLines = rows.map((row) =>
        headers
            .map((header) => escapeCsvField(row[header]))
            .join(",")
    );

    return [headerLine, ...dataLines].join("\r\n");
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



// Student Attendance Summary — CSV Download
//
// Same access rule and same underlying data as
// getStudentAttendanceSummary above, just returned as a
// downloadable .csv file instead of JSON.


exports.getStudentAttendanceSummaryCSV = (req, res) => {

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
                        CASE WHEN a.status='PRESENT' THEN 1 ELSE 0 END
                    ), 0) AS present,

                    COALESCE(SUM(
                        CASE WHEN a.status='ABSENT' THEN 1 ELSE 0 END
                    ), 0) AS absent,

                    COALESCE(SUM(
                        CASE WHEN a.status='LATE' THEN 1 ELSE 0 END
                    ), 0) AS late,

                    COALESCE(SUM(
                        CASE WHEN a.status='LEAVE' THEN 1 ELSE 0 END
                    ), 0) AS leave_count,

                    COALESCE(ROUND(
                        SUM(CASE WHEN a.status='PRESENT' THEN 1 ELSE 0 END)
                        * 100 / NULLIF(COUNT(a.id), 0), 2
                    ), 0) AS presence_percentage,

                    COALESCE(ROUND(
                        SUM(CASE WHEN a.status='ABSENT' THEN 1 ELSE 0 END)
                        * 100 / NULLIF(COUNT(a.id), 0), 2
                    ), 0) AS absence_percentage,

                    COALESCE(ROUND(
                        SUM(CASE WHEN a.status='LATE' THEN 1 ELSE 0 END)
                        * 100 / NULLIF(COUNT(a.id), 0), 2
                    ), 0) AS late_percentage,

                    COALESCE(ROUND(
                        SUM(CASE WHEN a.status='LEAVE' THEN 1 ELSE 0 END)
                        * 100 / NULLIF(COUNT(a.id), 0), 2
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

                    const headers = [
                        "student_id",
                        "full_name",
                        "roll_no",
                        "total_attendance",
                        "present",
                        "absent",
                        "late",
                        "leave_count",
                        "presence_percentage",
                        "absence_percentage",
                        "late_percentage",
                        "leave_percentage"
                    ];

                    const csv = rowsToCsv(headers, results);

                    const filename =
                        `student_${student_id}_attendance_report.csv`;

                    res.setHeader("Content-Type", "text/csv");
                    res.setHeader(
                        "Content-Disposition",
                        `attachment; filename="${filename}"`
                    );

                    return res.status(200).send(csv);

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



// Class Attendance Report — CSV Download
//
// Same access rule and same underlying data as
// getClassAttendanceReport above, just returned as a
// downloadable .csv file — one row per student in the class.


exports.getClassAttendanceReportCSV = (req, res) => {

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
                        CASE WHEN a.status='PRESENT' THEN 1 ELSE 0 END
                    ), 0) AS present,

                    COALESCE(SUM(
                        CASE WHEN a.status='ABSENT' THEN 1 ELSE 0 END
                    ), 0) AS absent,

                    COALESCE(SUM(
                        CASE WHEN a.status='LATE' THEN 1 ELSE 0 END
                    ), 0) AS late,

                    COALESCE(SUM(
                        CASE WHEN a.status='LEAVE' THEN 1 ELSE 0 END
                    ), 0) AS leave_count,

                    COALESCE(ROUND(
                        SUM(CASE WHEN a.status='PRESENT' THEN 1 ELSE 0 END)
                        * 100 / NULLIF(COUNT(a.id), 0), 2
                    ), 0) AS presence_percentage,

                    COALESCE(ROUND(
                        SUM(CASE WHEN a.status='ABSENT' THEN 1 ELSE 0 END)
                        * 100 / NULLIF(COUNT(a.id), 0), 2
                    ), 0) AS absence_percentage,

                    COALESCE(ROUND(
                        SUM(CASE WHEN a.status='LATE' THEN 1 ELSE 0 END)
                        * 100 / NULLIF(COUNT(a.id), 0), 2
                    ), 0) AS late_percentage,

                    COALESCE(ROUND(
                        SUM(CASE WHEN a.status='LEAVE' THEN 1 ELSE 0 END)
                        * 100 / NULLIF(COUNT(a.id), 0), 2
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

                    const headers = [
                        "student_id",
                        "full_name",
                        "roll_no",
                        "total_attendance",
                        "present",
                        "absent",
                        "late",
                        "leave_count",
                        "presence_percentage",
                        "absence_percentage",
                        "late_percentage",
                        "leave_percentage"
                    ];

                    const csv = rowsToCsv(headers, results);

                    const filename =
                        `class_${class_id}_attendance_report.csv`;

                    res.setHeader("Content-Type", "text/csv");
                    res.setHeader(
                        "Content-Disposition",
                        `attachment; filename="${filename}"`
                    );

                    return res.status(200).send(csv);

                }
            );

        }
    );
};



// Attendance Session Log
//
// Shows WHEN attendance was taken — one row per session, with the
// teacher, class, subject, and how many students were marked.
// SUPER_ADMIN sees everything, Department Admin sees sessions
// within their managed departments, a normal Teacher sees only
// their own sessions. Optional query params: class_id, from, to
// (dates, inclusive) to narrow the list.


exports.getSessionLog = (req, res) => {

    const {
        class_id,
        from,
        to
    } = req.query;


    let sql = `
        SELECT
            ats.id,
            ats.attendance_date,
            ta.day,
            ta.start_time,
            ta.end_time,
            u.id AS teacher_id,
            u.full_name AS teacher_name,
            c.class_name,
            s.subject_name,
            (
                SELECT COUNT(*)
                FROM attendance a
                WHERE a.attendance_session_id = ats.id
            ) AS marked_count

        FROM attendance_sessions ats

        JOIN teacher_assignments ta
            ON ats.teacher_assignment_id = ta.id

        JOIN users u
            ON ta.teacher_id = u.id

        JOIN classes c
            ON ta.class_id = c.id

        JOIN subjects s
            ON ta.subject_id = s.id

        WHERE 1=1
    `;

    const params = [];


    if (req.user.role === "SUPER_ADMIN") {
        // no extra scoping
    }
    else if (
        req.user.role === "TEACHER" &&
        Number(req.user.is_department_admin) === 1
    ) {

        sql += `
            AND EXISTS (
                SELECT 1
                FROM department_management dm
                WHERE dm.department_id = c.department_id
                AND dm.teacher_id = ?
            )
        `;
        params.push(req.user.id);

    }
    else if (req.user.role === "TEACHER") {

        sql += ` AND ta.teacher_id = ? `;
        params.push(req.user.id);

    }
    else {

        return res.status(403).json({
            success: false,
            message: "Access denied."
        });

    }


    if (class_id) {
        sql += ` AND ta.class_id = ? `;
        params.push(class_id);
    }

    if (from) {
        sql += ` AND ats.attendance_date >= ? `;
        params.push(from);
    }

    if (to) {
        sql += ` AND ats.attendance_date <= ? `;
        params.push(to);
    }


    sql += `
        ORDER BY ats.attendance_date DESC, ats.id DESC
        LIMIT 200
    `;


    db.query(
        sql,
        params,
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
                sessions: results
            });

        }
    );

};



// Sessions Taken Per Teacher
//
// How many attendance sessions each teacher has started, in
// total. SUPER_ADMIN sees all teachers; Department Admin sees
// only teachers who have an assignment within their managed
// departments.


exports.getTeacherSessionCounts = (req, res) => {

    let sql = `
        SELECT
            u.id AS teacher_id,
            u.full_name,
            COUNT(ats.id) AS total_sessions

        FROM users u

        JOIN teacher_assignments ta
            ON ta.teacher_id = u.id

        JOIN classes c
            ON ta.class_id = c.id

        LEFT JOIN attendance_sessions ats
            ON ats.teacher_assignment_id = ta.id

        WHERE u.role = 'TEACHER'
    `;

    const params = [];


    if (
        req.user.role === "TEACHER" &&
        Number(req.user.is_department_admin) === 1
    ) {

        sql += `
            AND EXISTS (
                SELECT 1
                FROM department_management dm
                WHERE dm.department_id = c.department_id
                AND dm.teacher_id = ?
            )
        `;
        params.push(req.user.id);

    }
    else if (req.user.role !== "SUPER_ADMIN") {

        return res.status(403).json({
            success: false,
            message: "Access denied."
        });

    }


    sql += `
        GROUP BY u.id, u.full_name
        ORDER BY total_sessions DESC
    `;


    db.query(
        sql,
        params,
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
                teachers: results
            });

        }
    );

};



// Student Attendance Report — Per Subject
//
// Same access rule as getStudentAttendanceSummary, but broken
// down one row per subject instead of a single combined total —
// this is what lets a student see "I'm at 60% in Networks but
// 95% in Database Management" instead of one blended number.


exports.getStudentSubjectReport = (req, res) => {

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
                    s.id AS subject_id,
                    s.subject_name,
                    c.class_name,

                    COUNT(a.id) AS total_attendance,

                    COALESCE(SUM(
                        CASE WHEN a.status='PRESENT' THEN 1 ELSE 0 END
                    ), 0) AS present,

                    COALESCE(SUM(
                        CASE WHEN a.status='ABSENT' THEN 1 ELSE 0 END
                    ), 0) AS absent,

                    COALESCE(SUM(
                        CASE WHEN a.status='LATE' THEN 1 ELSE 0 END
                    ), 0) AS late,

                    COALESCE(SUM(
                        CASE WHEN a.status='LEAVE' THEN 1 ELSE 0 END
                    ), 0) AS leave_count,

                    COALESCE(ROUND(
                        SUM(CASE WHEN a.status='PRESENT' THEN 1 ELSE 0 END)
                        * 100 / NULLIF(COUNT(a.id), 0), 2
                    ), 0) AS presence_percentage

                FROM student_classes sc

                JOIN users u
                    ON sc.student_id = u.id

                JOIN classes c
                    ON sc.class_id = c.id

                JOIN teacher_assignments ta
                    ON ta.class_id = c.id

                JOIN subjects s
                    ON ta.subject_id = s.id

                LEFT JOIN attendance_sessions ats
                    ON ats.teacher_assignment_id = ta.id

                LEFT JOIN attendance a
                    ON a.attendance_session_id = ats.id
                    AND a.student_id = u.id

                WHERE u.id = ?
                AND u.role = 'STUDENT'

                GROUP BY
                    s.id,
                    s.subject_name,
                    c.class_name

                ORDER BY s.subject_name
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

                    return res.json({
                        success: true,
                        student_id: student_id,
                        subjects: results
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

                    // Summary stats: how many sessions have been taken
                    // for this subject/class, and on average how many
                    // students were marked PRESENT per session — a
                    // turnout figure, separate from the per-student
                    // breakdown above.
                    const summarySql = `
                        SELECT
                            COUNT(DISTINCT ats.id) AS total_sessions,
                            COALESCE(ROUND(
                                COUNT(
                                    CASE WHEN a.status='PRESENT' THEN 1 END
                                ) / NULLIF(COUNT(DISTINCT ats.id), 0),
                                2
                            ), 0) AS average_present
                        FROM attendance_sessions ats
                        JOIN teacher_assignments ta
                            ON ats.teacher_assignment_id = ta.id
                        LEFT JOIN attendance a
                            ON a.attendance_session_id = ats.id
                        WHERE ta.subject_id = ?
                        AND ta.class_id = ?
                    `;

                    db.query(
                        summarySql,
                        [
                            subject_id,
                            class_id
                        ],
                        (err, summaryResults) => {

                            if (err) {
                                console.error(err);

                                return res.status(500).json({
                                    success: false,
                                    message: "Database Error"
                                });
                            }

                            const summary = summaryResults[0] || {
                                total_sessions: 0,
                                average_present: 0
                            };

                            return res.json({
                                success: true,
                                subject_id: subject_id,
                                class_id: class_id,
                                total_sessions: summary.total_sessions,
                                average_present: summary.average_present,
                                report: results
                            });

                        }
                    );

                }
            );

        }
    );
};



// Subject Attendance Report — CSV Download
//
// Same access rule and same underlying data as
// getSubjectAttendanceReport above, just returned as a
// downloadable .csv file — one row per student in the class.


exports.getSubjectAttendanceReportCSV = (req, res) => {

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
                        CASE WHEN a.status='PRESENT' THEN 1 ELSE 0 END
                    ), 0) AS present,

                    COALESCE(SUM(
                        CASE WHEN a.status='ABSENT' THEN 1 ELSE 0 END
                    ), 0) AS absent,

                    COALESCE(SUM(
                        CASE WHEN a.status='LATE' THEN 1 ELSE 0 END
                    ), 0) AS late,

                    COALESCE(SUM(
                        CASE WHEN a.status='LEAVE' THEN 1 ELSE 0 END
                    ), 0) AS leave_count,

                    COALESCE(ROUND(
                        SUM(CASE WHEN a.status='PRESENT' THEN 1 ELSE 0 END)
                        * 100 / NULLIF(COUNT(a.id), 0), 2
                    ), 0) AS presence_percentage,

                    COALESCE(ROUND(
                        SUM(CASE WHEN a.status='ABSENT' THEN 1 ELSE 0 END)
                        * 100 / NULLIF(COUNT(a.id), 0), 2
                    ), 0) AS absence_percentage,

                    COALESCE(ROUND(
                        SUM(CASE WHEN a.status='LATE' THEN 1 ELSE 0 END)
                        * 100 / NULLIF(COUNT(a.id), 0), 2
                    ), 0) AS late_percentage,

                    COALESCE(ROUND(
                        SUM(CASE WHEN a.status='LEAVE' THEN 1 ELSE 0 END)
                        * 100 / NULLIF(COUNT(a.id), 0), 2
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

                    const headers = [
                        "student_id",
                        "full_name",
                        "roll_no",
                        "total_attendance",
                        "present",
                        "absent",
                        "late",
                        "leave_count",
                        "presence_percentage",
                        "absence_percentage",
                        "late_percentage",
                        "leave_percentage"
                    ];

                    const csv = rowsToCsv(headers, results);

                    const filename =
                        `subject_${subject_id}_class_${class_id}_attendance_report.csv`;

                    res.setHeader("Content-Type", "text/csv");
                    res.setHeader(
                        "Content-Disposition",
                        `attachment; filename="${filename}"`
                    );

                    return res.status(200).send(csv);

                }
            );

        }
    );
};



// Student Session Detail — one subject, one student, every session
//
// Unlike the aggregate reports elsewhere, this returns one row per
// attendance SESSION (date, day, status) for a single student within
// one subject/class — a day-by-day log rather than a summary count.
// Sessions where this student wasn't marked at all show status: null
// rather than being silently omitted, so gaps are visible.


exports.getStudentSubjectSessionDetail = (req, res) => {

    const {
        subject_id,
        class_id,
        student_id
    } = req.params;

    if (!subject_id || !class_id || !student_id) {
        return res.status(400).json({
            success: false,
            message: "Subject ID, Class ID, and Student ID are required."
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
                    message: "You do not have permission to view this report."
                });
            }

            const sql = `
                SELECT
                    ats.attendance_date,
                    ta.day,
                    a.status

                FROM attendance_sessions ats

                JOIN teacher_assignments ta
                    ON ats.teacher_assignment_id = ta.id

                LEFT JOIN attendance a
                    ON a.attendance_session_id = ats.id
                    AND a.student_id = ?

                WHERE ta.subject_id = ?
                AND ta.class_id = ?

                ORDER BY ats.attendance_date ASC
            `;

            db.query(
                sql,
                [
                    student_id,
                    subject_id,
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
                        student_id: student_id,
                        subject_id: subject_id,
                        class_id: class_id,
                        sessions: results
                    });

                }
            );

        }
    );
};



// Student Session Detail — CSV Download
//
// Same data as getStudentSubjectSessionDetail above, as a
// downloadable .csv — one row per session date with that day's
// marking, rather than the aggregate totals in the other CSVs.


exports.getStudentSubjectSessionDetailCSV = (req, res) => {

    const {
        subject_id,
        class_id,
        student_id
    } = req.params;

    if (!subject_id || !class_id || !student_id) {
        return res.status(400).json({
            success: false,
            message: "Subject ID, Class ID, and Student ID are required."
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
                    message: "You do not have permission to view this report."
                });
            }

            const sql = `
                SELECT
                    ats.attendance_date,
                    ta.day,
                    a.status

                FROM attendance_sessions ats

                JOIN teacher_assignments ta
                    ON ats.teacher_assignment_id = ta.id

                LEFT JOIN attendance a
                    ON a.attendance_session_id = ats.id
                    AND a.student_id = ?

                WHERE ta.subject_id = ?
                AND ta.class_id = ?

                ORDER BY ats.attendance_date ASC
            `;

            db.query(
                sql,
                [
                    student_id,
                    subject_id,
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

                    const rows = results.map((r) => ({
                        attendance_date: r.attendance_date,
                        day: r.day,
                        status: r.status || "NOT MARKED"
                    }));

                    const headers = [
                        "attendance_date",
                        "day",
                        "status"
                    ];

                    const csv = rowsToCsv(headers, rows);

                    const filename =
                        `student_${student_id}_subject_${subject_id}_session_detail.csv`;

                    res.setHeader("Content-Type", "text/csv");
                    res.setHeader(
                        "Content-Disposition",
                        `attachment; filename="${filename}"`
                    );

                    return res.status(200).send(csv);

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

                    COUNT(DISTINCT ats.id) AS total_sessions,

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