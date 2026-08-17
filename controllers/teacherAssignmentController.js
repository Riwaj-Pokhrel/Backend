const db = require("../config/db");



const checkClassAccess = (req, class_id, callback) => {

    // SUPER_ADMIN can access everything
    if (req.user.role === "SUPER_ADMIN") {
        return callback(null, true);
    }

    // Only Department Admin can manage assignments
    if (
        req.user.role !== "TEACHER" ||
        Number(req.user.is_department_admin) !== 1
    ) {
        return callback(null, false);
    }

    db.query(
        `SELECT c.id
         FROM classes c
         JOIN department_management dm
             ON c.department_id = dm.department_id
         WHERE c.id = ?
         AND dm.teacher_id = ?
         AND c.is_active = 1`,
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
};



// Helper: Check whether user can manage an assignment


const checkAssignmentAccess = (req, assignment_id, callback) => {

    // SUPER_ADMIN can access everything
    if (req.user.role === "SUPER_ADMIN") {
        return callback(null, true);
    }

    // Only Department Admin can manage assignments
    if (
        req.user.role !== "TEACHER" ||
        Number(req.user.is_department_admin) !== 1
    ) {
        return callback(null, false);
    }

    db.query(
        `SELECT ta.id
         FROM teacher_assignments ta
         JOIN classes c
             ON ta.class_id = c.id
         JOIN department_management dm
             ON c.department_id = dm.department_id
         WHERE ta.id = ?
         AND dm.teacher_id = ?`,
        [
            assignment_id,
            req.user.id
        ],
        (err, result) => {

            if (err) {
                return callback(err);
            }

            callback(null, result.length > 0);
        }
    );
};



// Helper: Check whether the teacher already has an
// overlapping assignment on the same day, regardless
// of class/subject. Prevents double-booking a teacher
// into two places at once.


const checkTeacherScheduleConflict = (
    teacher_id,
    day,
    start_time,
    end_time,
    exclude_assignment_id,
    callback
) => {

    let sql = `
        SELECT id
        FROM teacher_assignments
        WHERE teacher_id = ?
        AND day = ?
        AND is_active = 1
        AND start_time < ?
        AND end_time > ?
    `;

    const params = [
        teacher_id,
        day,
        end_time,
        start_time
    ];

    if (exclude_assignment_id) {
        sql += ` AND id <> ?`;
        params.push(exclude_assignment_id);
    }

    db.query(
        sql,
        params,
        (err, result) => {

            if (err) {
                return callback(err);
            }

            callback(null, result.length > 0);
        }
    );
};



// Assign Teacher
// SUPER_ADMIN / Department Admin


exports.assignTeacher = (req, res) => {

    const {
        teacher_id,
        class_id,
        subject_id,
        day,
        start_time,
        end_time
    } = req.body;


    if (
        !teacher_id ||
        !class_id ||
        !subject_id ||
        !day ||
        !start_time ||
        !end_time
    ) {
        return res.status(400).json({
            success: false,
            message: "All fields are required."
        });
    }


    // Validate time
    if (start_time >= end_time) {
        return res.status(400).json({
            success: false,
            message: "End time must be later than start time."
        });
    }


    // Check class access
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
                    message:
                        "You do not have permission to manage assignments for this class."
                });
            }


            // Check Teacher
            db.query(
                `SELECT id
                 FROM users
                 WHERE id = ?
                 AND role = 'TEACHER'
                 AND is_active = 1`,
                [teacher_id],
                (err, teacherResult) => {

                    if (err) {
                        console.error(err);

                        return res.status(500).json({
                            success: false,
                            message: "Database Error"
                        });
                    }


                    if (teacherResult.length === 0) {
                        return res.status(400).json({
                            success: false,
                            message: "Teacher not found or inactive."
                        });
                    }


                    // Check Class
                    db.query(
                        `SELECT id
                         FROM classes
                         WHERE id = ?
                         AND is_active = 1`,
                        [class_id],
                        (err, classResult) => {

                            if (err) {
                                console.error(err);

                                return res.status(500).json({
                                    success: false,
                                    message: "Database Error"
                                });
                            }


                            if (classResult.length === 0) {
                                return res.status(400).json({
                                    success: false,
                                    message: "Class not found or inactive."
                                });
                            }


                            // Check Subject
                            db.query(
                                `SELECT id
                                 FROM subjects
                                 WHERE id = ?
                                 AND class_id = ?
                                 AND is_archived = 0`,
                                [
                                    subject_id,
                                    class_id
                                ],
                                (err, subjectResult) => {

                                    if (err) {
                                        console.error(err);

                                        return res.status(500).json({
                                            success: false,
                                            message: "Database Error"
                                        });
                                    }


                                    if (subjectResult.length === 0) {
                                        return res.status(400).json({
                                            success: false,
                                            message:
                                                "Subject not found or archived."
                                        });
                                    }


                                    // Check the teacher isn't already
                                    // booked elsewhere at this time
                                    checkTeacherScheduleConflict(
                                        teacher_id,
                                        day,
                                        start_time,
                                        end_time,
                                        null,
                                        (err, teacherConflict) => {

                                            if (err) {
                                                console.error(err);

                                                return res.status(500).json({
                                                    success: false,
                                                    message: "Database Error"
                                                });
                                            }


                                            if (teacherConflict) {
                                                return res.status(400).json({
                                                    success: false,
                                                    message:
                                                        "This teacher already has another assignment that overlaps with the selected time."
                                                });
                                            }


                                            // Check the class doesn't already
                                            // have something else scheduled at
                                            // an overlapping time — a class can
                                            // only have one subject happening
                                            // at once, regardless of which one.
                                            db.query(
                                                `SELECT id
                                                 FROM teacher_assignments
                                                 WHERE class_id = ?
                                                 AND day = ?
                                                 AND is_active = 1
                                                 AND start_time < ?
                                                 AND end_time > ?`,
                                                [
                                                    class_id,
                                                    day,
                                                    end_time,
                                                    start_time
                                                ],
                                                (err, overlapResult) => {

                                                    if (err) {
                                                        console.error(err);

                                                        return res.status(500).json({
                                                            success: false,
                                                            message: "Database Error"
                                                        });
                                                    }


                                                    if (overlapResult.length > 0) {
                                                        return res.status(400).json({
                                                            success: false,
                                                            message:
                                                                "This class already has another subject scheduled at the selected time."
                                                        });
                                                    }


                                                    // Insert Assignment
                                                    db.query(
                                                        `INSERT INTO teacher_assignments
                                                        (
                                                            teacher_id,
                                                            class_id,
                                                            subject_id,
                                                            day,
                                                            start_time,
                                                            end_time,
                                                            is_active
                                                        )
                                                        VALUES (?, ?, ?, ?, ?, ?, 1)`,
                                                        [
                                                            teacher_id,
                                                            class_id,
                                                            subject_id,
                                                            day,
                                                            start_time,
                                                            end_time
                                                        ],
                                                        (err, result) => {

                                                            if (err) {

                                                                if (
                                                                    err.code ===
                                                                    "ER_DUP_ENTRY"
                                                                ) {
                                                                    return res.status(400).json({
                                                                        success: false,
                                                                        message:
                                                                            "Assignment already exists."
                                                                    });
                                                                }


                                                                console.error(err);

                                                                return res.status(500).json({
                                                                    success: false,
                                                                    message:
                                                                        "Database Error"
                                                                });
                                                            }


                                                            return res.status(201).json({
                                                                success: true,
                                                                message:
                                                                    "Teacher assigned successfully.",
                                                                id: result.insertId
                                                            });

                                                        }
                                                    );

                                                }
                                            );

                                        }
                                    );

                                }
                            );

                        }
                    );

                }
            );

        }
    );
};




exports.getAllAssignments = (req, res) => {

    let sql = `
        SELECT
            ta.id,
            ta.teacher_id,
            u.full_name AS teacher,
            c.id AS class_id,
            c.class_name,
            s.id AS subject_id,
            s.subject_name,
            ta.day,
            ta.start_time,
            ta.end_time,
            ta.is_active
        FROM teacher_assignments ta

        JOIN users u
            ON ta.teacher_id = u.id

        JOIN classes c
            ON ta.class_id = c.id

        JOIN subjects s
            ON ta.subject_id = s.id
    `;

    const params = [];


    // SUPER_ADMIN
    if (req.user.role === "SUPER_ADMIN") {

        sql += `
            ORDER BY
                u.full_name,
                ta.day,
                ta.start_time
        `;

    }

    // Department Admin
    else if (
        req.user.role === "TEACHER" &&
        Number(req.user.is_department_admin) === 1
    ) {

        sql += `
            JOIN department_management dm
                ON c.department_id = dm.department_id

            WHERE dm.teacher_id = ?

            ORDER BY
                u.full_name,
                ta.day,
                ta.start_time
        `;

        params.push(req.user.id);

    }

    // Normal Teacher
    else if (req.user.role === "TEACHER") {

        sql += `
            WHERE ta.teacher_id = ?

            ORDER BY
                ta.day,
                ta.start_time
        `;

        params.push(req.user.id);

    }

    else {

        return res.status(403).json({
            success: false,
            message: "Access denied."
        });

    }


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
                assignments: results
            });

        }
    );
};



// View Assignments By Teacher


exports.getAssignmentsByTeacher = (req, res) => {

    const {
        teacher_id
    } = req.params;


    // Normal teacher can only view their own assignments
    if (
        req.user.role === "TEACHER" &&
        Number(req.user.is_department_admin) !== 1 &&
        Number(teacher_id) !== Number(req.user.id)
    ) {
        return res.status(403).json({
            success: false,
            message: "You can only view your own assignments."
        });
    }


    let sql = `
        SELECT
            ta.id,
            ta.teacher_id,
            c.id AS class_id,
            c.class_name,
            s.id AS subject_id,
            s.subject_name,
            ta.day,
            ta.start_time,
            ta.end_time,
            ta.is_active
        FROM teacher_assignments ta

        JOIN classes c
            ON ta.class_id = c.id

        JOIN subjects s
            ON ta.subject_id = s.id
    `;

    const params = [teacher_id];


    // SUPER_ADMIN
    if (req.user.role === "SUPER_ADMIN") {

        sql += `
            WHERE ta.teacher_id = ?

            ORDER BY
                ta.day,
                ta.start_time
        `;

    }

    // Department Admin
    else if (
        req.user.role === "TEACHER" &&
        Number(req.user.is_department_admin) === 1
    ) {

        sql += `
            JOIN department_management dm
                ON c.department_id = dm.department_id

            WHERE ta.teacher_id = ?
            AND dm.teacher_id = ?

            ORDER BY
                ta.day,
                ta.start_time
        `;

        params.push(req.user.id);

    }

    // Normal Teacher
    else if (req.user.role === "TEACHER") {

        sql += `
            WHERE ta.teacher_id = ?

            ORDER BY
                ta.day,
                ta.start_time
        `;

    }

    else {

        return res.status(403).json({
            success: false,
            message: "Access denied."
        });

    }


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
                assignments: results
            });

        }
    );
};



// View Assignments By Class


exports.getAssignmentsByClass = (req, res) => {

    const {
        class_id
    } = req.params;


    // Department Admin / Super Admin
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


            // Normal teacher
            if (
                req.user.role === "TEACHER" &&
                Number(req.user.is_department_admin) !== 1
            ) {

                const teacherSql = `
                    SELECT
                        ta.id,
                        ta.teacher_id,
                        u.full_name AS teacher,
                        ta.class_id,
                        ta.subject_id,
                        s.subject_name,
                        ta.day,
                        ta.start_time,
                        ta.end_time,
                        ta.is_active
                    FROM teacher_assignments ta

                    JOIN users u
                        ON ta.teacher_id = u.id

                    JOIN subjects s
                        ON ta.subject_id = s.id

                    WHERE ta.class_id = ?
                    AND ta.teacher_id = ?

                    ORDER BY
                        ta.day,
                        ta.start_time
                `;


                return db.query(
                    teacherSql,
                    [
                        class_id,
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
                            assignments: results
                        });

                    }
                );

            }


            // Admin access
            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message:
                        "You do not have permission to view assignments for this class."
                });
            }


            const sql = `
                SELECT
                    ta.id,
                    ta.teacher_id,
                    u.full_name AS teacher,
                    ta.class_id,
                    ta.subject_id,
                    s.subject_name,
                    ta.day,
                    ta.start_time,
                    ta.end_time,
                    ta.is_active
                FROM teacher_assignments ta

                JOIN users u
                    ON ta.teacher_id = u.id

                JOIN subjects s
                    ON ta.subject_id = s.id

                WHERE ta.class_id = ?

                ORDER BY
                    ta.day,
                    ta.start_time
            `;


            db.query(
                sql,
                [class_id],
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
                        assignments: results
                    });

                }
            );

        }
    );
};



// Update Assignment
// SUPER_ADMIN / Department Admin


exports.updateAssignment = (req, res) => {

    const {
        id
    } = req.params;


    const {
        teacher_id,
        class_id,
        subject_id,
        day,
        start_time,
        end_time
    } = req.body;


    if (
        !teacher_id ||
        !class_id ||
        !subject_id ||
        !day ||
        !start_time ||
        !end_time
    ) {
        return res.status(400).json({
            success: false,
            message: "All fields are required."
        });
    }


    if (start_time >= end_time) {
        return res.status(400).json({
            success: false,
            message: "End time must be later than start time."
        });
    }


    // Check current assignment access
    checkAssignmentAccess(
        req,
        id,
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
                    message:
                        "You do not have permission to update this assignment."
                });
            }


            // Check new class access
            checkClassAccess(
                req,
                class_id,
                (err, newClassAccess) => {

                    if (err) {
                        console.error(err);

                        return res.status(500).json({
                            success: false,
                            message: "Database Error"
                        });
                    }


                    if (!newClassAccess) {
                        return res.status(403).json({
                            success: false,
                            message:
                                "You do not have permission to move this assignment to the selected class."
                        });
                    }


                    // Check Teacher
                    db.query(
                        `SELECT id
                         FROM users
                         WHERE id = ?
                         AND role = 'TEACHER'
                         AND is_active = 1`,
                        [teacher_id],
                        (err, teacherResult) => {

                            if (err) {
                                console.error(err);

                                return res.status(500).json({
                                    success: false,
                                    message: "Database Error"
                                });
                            }


                            if (teacherResult.length === 0) {
                                return res.status(400).json({
                                    success: false,
                                    message:
                                        "Teacher not found or inactive."
                                });
                            }


                            // Check Class
                            db.query(
                                `SELECT id
                                 FROM classes
                                 WHERE id = ?
                                 AND is_active = 1`,
                                [class_id],
                                (err, classResult) => {

                                    if (err) {
                                        console.error(err);

                                        return res.status(500).json({
                                            success: false,
                                            message: "Database Error"
                                        });
                                    }


                                    if (classResult.length === 0) {
                                        return res.status(400).json({
                                            success: false,
                                            message:
                                                "Class not found or inactive."
                                        });
                                    }


                                    // Check Subject
                                    db.query(
                                        `SELECT id
                                         FROM subjects
                                         WHERE id = ?
                                         AND class_id = ?
                                         AND is_archived = 0`,
                                        [
                                            subject_id,
                                            class_id
                                        ],
                                        (err, subjectResult) => {

                                            if (err) {
                                                console.error(err);

                                                return res.status(500).json({
                                                    success: false,
                                                    message: "Database Error"
                                                });
                                            }


                                            if (subjectResult.length === 0) {
                                                return res.status(400).json({
                                                    success: false,
                                                    message:
                                                        "Subject not found or archived."
                                                });
                                            }


                                            // Check the teacher isn't already
                                            // booked elsewhere at this time
                                            // (excluding this assignment itself)
                                            checkTeacherScheduleConflict(
                                                teacher_id,
                                                day,
                                                start_time,
                                                end_time,
                                                id,
                                                (err, teacherConflict) => {

                                                    if (err) {
                                                        console.error(err);

                                                        return res.status(500).json({
                                                            success: false,
                                                            message: "Database Error"
                                                        });
                                                    }


                                                    if (teacherConflict) {
                                                        return res.status(400).json({
                                                            success: false,
                                                            message:
                                                                "This teacher already has another assignment that overlaps with the selected time."
                                                        });
                                                    }


                                                    // Check the class doesn't already
                                                    // have something else scheduled at
                                                    // an overlapping time (excluding
                                                    // this assignment itself)
                                                    db.query(
                                                        `SELECT id
                                                         FROM teacher_assignments
                                                         WHERE class_id = ?
                                                         AND day = ?
                                                         AND is_active = 1
                                                         AND id <> ?
                                                         AND start_time < ?
                                                         AND end_time > ?`,
                                                        [
                                                            class_id,
                                                            day,
                                                            id,
                                                            end_time,
                                                            start_time
                                                        ],
                                                        (err, overlapResult) => {

                                                            if (err) {
                                                                console.error(err);

                                                                return res.status(500).json({
                                                                    success: false,
                                                                    message:
                                                                        "Database Error"
                                                                });
                                                            }


                                                            if (overlapResult.length > 0) {
                                                                return res.status(400).json({
                                                                    success: false,
                                                                    message:
                                                                        "This class already has another subject scheduled at the selected time."
                                                                });
                                                            }


                                                            // Update
                                                            db.query(
                                                                `UPDATE teacher_assignments
                                                                 SET
                                                                    teacher_id = ?,
                                                                    class_id = ?,
                                                                    subject_id = ?,
                                                                    day = ?,
                                                                    start_time = ?,
                                                                    end_time = ?
                                                                 WHERE id = ?`,
                                                                [
                                                                    teacher_id,
                                                                    class_id,
                                                                    subject_id,
                                                                    day,
                                                                    start_time,
                                                                    end_time,
                                                                    id
                                                                ],
                                                                (err, result) => {

                                                                    if (err) {

                                                                        if (
                                                                            err.code ===
                                                                            "ER_DUP_ENTRY"
                                                                        ) {
                                                                            return res.status(400).json({
                                                                                success: false,
                                                                                message:
                                                                                    "Assignment already exists."
                                                                            });
                                                                        }


                                                                        console.error(err);

                                                                        return res.status(500).json({
                                                                            success: false,
                                                                            message:
                                                                                "Database Error"
                                                                        });
                                                                    }


                                                                    if (
                                                                        result.affectedRows === 0
                                                                    ) {
                                                                        return res.status(404).json({
                                                                            success: false,
                                                                            message:
                                                                                "Assignment not found."
                                                                        });
                                                                    }


                                                                    return res.json({
                                                                        success: true,
                                                                        message:
                                                                            "Assignment updated successfully."
                                                                    });

                                                                }
                                                            );

                                                        }
                                                    );

                                                }
                                            );

                                        }
                                    );

                                }
                            );

                        }
                    );

                }
            );

        }
    );
};



// Activate / Deactivate Assignment
// SUPER_ADMIN / Department Admin


exports.toggleAssignmentStatus = (req, res) => {

    const {
        id
    } = req.params;


    checkAssignmentAccess(
        req,
        id,
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
                    message:
                        "You do not have permission to change this assignment."
                });
            }


            db.query(
                `UPDATE teacher_assignments
                 SET is_active = NOT is_active
                 WHERE id = ?`,
                [id],
                (err, result) => {

                    if (err) {
                        console.error(err);

                        return res.status(500).json({
                            success: false,
                            message: "Database Error"
                        });
                    }


                    if (result.affectedRows === 0) {
                        return res.status(404).json({
                            success: false,
                            message: "Assignment not found."
                        });
                    }


                    return res.json({
                        success: true,
                        message:
                            "Assignment status updated successfully."
                    });

                }
            );

        }
    );
};



// Delete Assignment
// SUPER_ADMIN / Department Admin

exports.deleteAssignment = (req, res) => {

    const {
        id
    } = req.params;

    checkAssignmentAccess(
        req,
        id,
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
                    message:
                        "You do not have permission to delete this assignment."
                });
            }


            // 1. Attendance records for sessions under this assignment
            db.query(
                `DELETE a
                 FROM attendance a
                 JOIN attendance_sessions ats
                     ON a.attendance_session_id = ats.id
                 WHERE ats.teacher_assignment_id = ?`,
                [id],
                (err) => {

                    if (err) {
                        console.error(err);

                        return res.status(500).json({
                            success: false,
                            message: "Database Error"
                        });
                    }


                    // 2. Attendance sessions under this assignment
                    db.query(
                        `DELETE FROM attendance_sessions
                         WHERE teacher_assignment_id = ?`,
                        [id],
                        (err) => {

                            if (err) {
                                console.error(err);

                                return res.status(500).json({
                                    success: false,
                                    message: "Database Error"
                                });
                            }


                            // 3. The assignment itself
                            db.query(
                                `DELETE FROM teacher_assignments
                                 WHERE id = ?`,
                                [id],
                                (err, result) => {

                                    if (err) {
                                        console.error(err);

                                        return res.status(500).json({
                                            success: false,
                                            message: "Database Error"
                                        });
                                    }

                                    if (result.affectedRows === 0) {
                                        return res.status(404).json({
                                            success: false,
                                            message: "Assignment not found."
                                        });
                                    }

                                    return res.json({
                                        success: true,
                                        message: "Assignment and its attendance history deleted successfully."
                                    });

                                }
                            );

                        }
                    );

                }
            );

        }
    );
};